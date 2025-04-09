import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string, filter?: string) => void;
  showFilters?: boolean;
  placeholder?: string;
  buttonText?: string;
  icon?: React.ReactNode;
}

export default function SearchBar({
  onSearch,
  showFilters = false,
  placeholder = "YouTube URLまたは検索キーワードを入力...",
  buttonText = "検索",
  icon = <Search className="h-4 w-4 mr-1" />
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("video");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery, activeFilter);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter);
  };

  return (
    <div className="bg-card rounded-lg shadow-md p-4 mb-6 dark:border dark:border-border">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-grow">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pr-10"
            required
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" className="px-6 py-3 flex items-center justify-center">
          {icon}
          {buttonText}
        </Button>
      </form>

      {showFilters && (
        <div className="mt-4 pt-3 border-t border-muted">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center font-medium dark:text-foreground">フィルター:</span>
            <Badge
              variant={activeFilter === "video" ? "default" : "outline"}
              className={`cursor-pointer transition-colors px-3 py-1 text-sm hover:opacity-80 ${
                activeFilter === "video" 
                  ? "dark:bg-blue-600 dark:text-white dark:shadow-sm"
                  : "dark:hover:bg-accent/60 dark:text-foreground dark:border-muted/60"
              }`}
              onClick={() => handleFilterClick("video")}
            >
              動画
            </Badge>
            <Badge
              variant={activeFilter === "channel" ? "default" : "outline"}
              className={`cursor-pointer transition-colors px-3 py-1 text-sm hover:opacity-80 ${
                activeFilter === "channel" 
                  ? "dark:bg-purple-600 dark:text-white dark:shadow-sm"
                  : "dark:hover:bg-accent/60 dark:text-foreground dark:border-muted/60"
              }`}
              onClick={() => handleFilterClick("channel")}
            >
              チャンネル
            </Badge>
            <Badge
              variant={activeFilter === "playlist" ? "default" : "outline"}
              className={`cursor-pointer transition-colors px-3 py-1 text-sm hover:opacity-80 ${
                activeFilter === "playlist" 
                  ? "dark:bg-green-600 dark:text-white dark:shadow-sm"
                  : "dark:hover:bg-accent/60 dark:text-foreground dark:border-muted/60"
              }`}
              onClick={() => handleFilterClick("playlist")}
            >
              プレイリスト
            </Badge>
            <Badge
              variant={activeFilter === "live" ? "default" : "outline"}
              className={`cursor-pointer transition-colors px-3 py-1 text-sm hover:opacity-80 ${
                activeFilter === "live" 
                  ? "dark:bg-red-600 dark:text-white dark:shadow-sm"
                  : "dark:hover:bg-accent/60 dark:text-foreground dark:border-muted/60"
              }`}
              onClick={() => handleFilterClick("live")}
            >
              ライブ
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
