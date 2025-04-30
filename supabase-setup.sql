-- テーブル作成用の関数
CREATE OR REPLACE FUNCTION create_board_posts_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS board_posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes INTEGER DEFAULT 0,
    image_url TEXT
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_board_comments_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS board_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes INTEGER DEFAULT 0
  );
END;
$$ LANGUAGE plpgsql;

-- いいねカウントを増やすための関数
CREATE OR REPLACE FUNCTION increment_post_likes(post_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE board_posts SET likes = likes + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE board_comments SET likes = likes + 1 WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;