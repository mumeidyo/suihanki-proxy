/**
 * システムモニターモジュール
 * 
 * このモジュールはReplit環境およびRender環境でのメモリ使用量とCPU使用率を監視し、
 * サーバーの安定性を向上させるための機能を提供します。
 * Render環境では特に、コンテナの制限内で動作し続けるように最適化されています。
 */

import { log } from './vite';
import os from 'os';

// モニタリング設定
const MONITORING_INTERVAL = 30000; // 30秒ごとにチェック
const MEMORY_THRESHOLD = 0.85; // メモリ使用率が85%を超えると警告
const CPU_THRESHOLD = 0.90; // CPU使用率が90%を超えると警告
const CRITICAL_MEMORY_THRESHOLD = 0.95; // メモリ使用率が95%を超えると重大警告

// 環境に応じた設定
const isRender = process.env.RENDER === 'true';
const isReplit = process.env.REPL_ID !== undefined;

// Render環境用の設定
const RENDER_MEMORY_THRESHOLD = 0.75; // Render環境ではメモリ制限が厳しいため、より早く対応
const RENDER_MONITORING_INTERVAL = 60000; // Render環境では負荷軽減のため監視間隔を長く設定

let monitoringInterval: NodeJS.Timeout | null = null;
let isCleanupScheduled = false;
let shuttingDown = false;

/**
 * システムモニタリングを開始する
 */
export function startSystemMonitoring(): void {
  // 環境に応じたメッセージを表示
  const environment = isRender ? 'Render' : isReplit ? 'Replit' : 'local';
  log(`Starting system monitoring for improved stability in ${environment} environment`, 'system-monitor');
  
  // 初回実行
  checkSystemResources();
  
  // 環境に応じて監視間隔を設定
  const interval = isRender ? RENDER_MONITORING_INTERVAL : MONITORING_INTERVAL;
  monitoringInterval = setInterval(checkSystemResources, interval);
  
  // プロセス終了時にクリーンアップ
  process.on('exit', stopSystemMonitoring);
  
  // シグナル処理
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach(signal => {
    process.on(signal, () => {
      log(`Received ${signal} signal, shutting down gracefully...`, 'system-monitor');
      // 一旦すべてのリクエストを止める前に必要なクリーンアップを実行
      stopSystemMonitoring();
      // 猶予をもって終了（クリーンアップが終わるまで待つ）
      setTimeout(() => {
        log('Exiting process after cleanup', 'system-monitor');
        process.exit(0);
      }, 1000);
    });
  });
}

/**
 * システムモニタリングを停止する
 */
export function stopSystemMonitoring(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  
  log('Gracefully stopping system monitoring...', 'system-monitor');
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    log('System monitoring stopped', 'system-monitor');
  }
  
  // Clean up resources before exit
  performMemoryCleanup();
}

/**
 * システムリソースをチェックする
 */
function checkSystemResources(): void {
  // メモリ使用率をチェック
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = usedMemory / totalMemory;
  
  // CPU使用率をチェック（簡易版）
  const cpus = os.cpus();
  const cpuUsage = getCpuUsagePercent(cpus);
  
  // メモリ使用率のログ出力
  log(`Memory usage: ${(memoryUsage * 100).toFixed(2)}% | CPU usage: ${cpuUsage.toFixed(2)}%`, 'system-monitor');
  
  // 環境に応じたメモリ閾値を使用
  const memoryThreshold = isRender ? RENDER_MEMORY_THRESHOLD : MEMORY_THRESHOLD;
  
  // メモリ使用率が閾値を超えた場合の処理
  if (memoryUsage > CRITICAL_MEMORY_THRESHOLD) {
    log('CRITICAL: Memory usage is extremely high, performing emergency cleanup', 'system-monitor');
    performEmergencyCleanup();
  } else if (memoryUsage > memoryThreshold) {
    log(`WARNING: High memory usage detected (${(memoryUsage * 100).toFixed(2)}%), scheduling cleanup`, 'system-monitor');
    scheduleMemoryCleanup();
  }
  
  // CPU使用率が閾値を超えた場合の処理
  if (cpuUsage > CPU_THRESHOLD * 100) {
    log('WARNING: High CPU usage detected', 'system-monitor');
    reduceCpuLoad();
  }
}

/**
 * CPU使用率を計算する（簡易版）
 */
function getCpuUsagePercent(cpus: os.CpuInfo[]): number {
  // 簡易的なCPU使用率計算
  // 実際のアプリケーションでは、前回の値との差分を計算する必要がある
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  
  return 100 - (totalIdle / totalTick * 100);
}

/**
 * メモリクリーンアップを予約する
 */
function scheduleMemoryCleanup(): void {
  if (!isCleanupScheduled) {
    isCleanupScheduled = true;
    setTimeout(() => {
      performMemoryCleanup();
      isCleanupScheduled = false;
    }, 5000); // 5秒後にクリーンアップを実行
  }
}

/**
 * メモリクリーンアップを実行する
 */
function performMemoryCleanup(): void {
  log('Performing memory cleanup', 'system-monitor');
  
  try {
    // キャッシュをクリア
    global.gc && global.gc();
    
    // Node.jsのヒープを最適化するためのコード
    // ヒープダンプを取得して解析するツールを使用することも推奨
    
    log('Memory cleanup completed', 'system-monitor');
  } catch (error) {
    log(`Memory cleanup failed: ${error}`, 'system-monitor');
  }
}

/**
 * 緊急メモリクリーンアップを実行する
 */
function performEmergencyCleanup(): void {
  log('Performing emergency memory cleanup', 'system-monitor');
  
  try {
    // 強制的なガベージコレクション
    global.gc && global.gc();
    
    // 一時キャッシュをクリア
    clearCache();
    
    // 不要なタイマーを停止
    
    log('Emergency cleanup completed', 'system-monitor');
  } catch (error) {
    log(`Emergency cleanup failed: ${error}`, 'system-monitor');
    
    // 最終手段として、プロセスを再起動することも検討
    // ただし、これはユーザーに影響を与えるため、最後の手段として使用する
  }
}

/**
 * CPU負荷を軽減する
 */
function reduceCpuLoad(): void {
  log('Attempting to reduce CPU load', 'system-monitor');
  
  // 非同期タスクを延期
  // バックグラウンドジョブを一時停止
  // ロギングレベルを下げる
}

/**
 * キャッシュをクリアする
 */
function clearCache(): void {
  // アプリケーション固有のキャッシュクリア処理
  // 例: メモリ内のキャッシュをクリア
}

// TypeScriptでグローバルに追加
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}