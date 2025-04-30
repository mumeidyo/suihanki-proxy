import { type UserRole, ROLE_DISPLAY_NAMES, ROLE_COLORS } from "@/lib/role-manager";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RoleBadgeProps {
  role: UserRole;
  showTooltip?: boolean;
  className?: string;
}

/**
 * 権限バッジコンポーネント
 * ユーザーの権限を表示するためのバッジ
 */
export function RoleBadge({ role, showTooltip = true, className = "" }: RoleBadgeProps) {
  // ゲスト権限の場合は表示しない
  if (role === 'guest') return null;

  // 権限によってアイコンを変更
  const Icon = getIconForRole(role);
  const colorClass = ROLE_COLORS[role];
  
  const badge = (
    <span 
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${colorClass} ${className}`}
    >
      <Icon className="h-3 w-3 mr-0.5" />
      {ROLE_DISPLAY_NAMES[role]}
    </span>
  );

  // ツールチップ表示するかどうか
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{getRoleDescription(role)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * 役割ごとのアイコンを取得
 */
function getIconForRole(role: UserRole) {
  switch (role) {
    case 'developer':
      return ShieldAlert;
    case 'leader':
      return ShieldAlert;
    case 'admin':
      return ShieldCheck;
    default:
      return Shield;
  }
}

/**
 * 役割の説明文を取得
 */
function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'developer':
      return '開発者: システム全体を管理する最高権限です';
    case 'leader':
      return 'リーダー: 他のユーザーの権限を管理できます';
    case 'admin':
      return 'アドミン: 多くのコンテンツを管理できます';
    case 'member':
      return 'メンバー: 認証済みユーザーです';
    default:
      return 'ゲスト: 一般権限です';
  }
}