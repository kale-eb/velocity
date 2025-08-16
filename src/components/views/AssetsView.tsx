import React, { useState, useMemo } from 'react';
import { Search, Filter, Grid, List, Plus, Upload, Download, Trash2, Eye, Edit3, Copy, FileVideo, FileImage, FileAudio, MoreHorizontal, Star, Calendar, Size, Clock } from 'lucide-react';

// Props interface
interface AssetsViewProps {
  theme: 'light' | 'dark' | 'experimental';
}

// Asset interface
interface Asset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  size: string;
  duration?: string;
  thumbnail?: string;
  tags: string[];
  uploadedAt: string;
  lastModified: string;
  favorite?: boolean;
  folder?: string;
  resolution?: string;
  format?: string;
  description?: string;
}

// Mock enhanced assets data
const mockAssets: Asset[] = [
  { 
    id: '1', 
    name: 'Product Demo v2.mp4', 
    type: 'video', 
    size: '12.5 MB', 
    duration: '0:45', 
    tags: ['product', 'demo', 'v2'], 
    uploadedAt: '2024-01-15',
    lastModified: '2024-01-15',
    favorite: true,
    folder: 'Products',
    resolution: '1920x1080',
    format: 'MP4',
    description: 'Updated product demonstration video with new features'
  },
  { 
    id: '2', 
    name: 'Customer Testimonial - Sarah.mp4', 
    type: 'video', 
    size: '24.8 MB', 
    duration: '1:20', 
    tags: ['testimonial', 'customer', 'sarah'], 
    uploadedAt: '2024-01-14',
    lastModified: '2024-01-14',
    folder: 'Testimonials',
    resolution: '1920x1080',
    format: 'MP4',
    description: 'Customer testimonial from Sarah about our services'
  },
  { 
    id: '3', 
    name: 'Behind the Scenes - Studio.mp4', 
    type: 'video', 
    size: '45.2 MB', 
    duration: '2:15', 
    tags: ['bts', 'behind scenes', 'studio'], 
    uploadedAt: '2024-01-12',
    lastModified: '2024-01-13',
    folder: 'BTS',
    resolution: '1920x1080',
    format: 'MP4'
  },
  { 
    id: '4', 
    name: 'Hero Banner - Homepage.jpg', 
    type: 'image', 
    size: '2.1 MB', 
    tags: ['hero', 'banner', 'homepage'], 
    uploadedAt: '2024-01-10',
    lastModified: '2024-01-11',
    favorite: true,
    folder: 'Graphics',
    resolution: '2560x1440',
    format: 'JPG',
    description: 'Main hero banner for homepage redesign'
  },
  { 
    id: '5', 
    name: 'Logo Animation - Final.mp4', 
    type: 'video', 
    size: '8.7 MB', 
    duration: '0:30', 
    tags: ['logo', 'animation', 'final'], 
    uploadedAt: '2024-01-09',
    lastModified: '2024-01-10',
    folder: 'Branding',
    resolution: '1920x1080',
    format: 'MP4'
  },
  { 
    id: '6', 
    name: 'Team Photo - 2024.jpg', 
    type: 'image', 
    size: '3.4 MB', 
    tags: ['team', 'photo', '2024'], 
    uploadedAt: '2024-01-08',
    lastModified: '2024-01-08',
    folder: 'Team',
    resolution: '3840x2160',
    format: 'JPG'
  },
  { 
    id: '7', 
    name: 'Background Music - Upbeat.mp3', 
    type: 'audio', 
    size: '4.2 MB', 
    duration: '2:30', 
    tags: ['music', 'background', 'upbeat'], 
    uploadedAt: '2024-01-07',
    lastModified: '2024-01-07',
    folder: 'Audio',
    format: 'MP3',
    description: 'Upbeat background music for promotional videos'
  },
  { 
    id: '8', 
    name: 'Voiceover - Professional.mp3', 
    type: 'audio', 
    size: '6.8 MB', 
    duration: '3:45', 
    tags: ['voice', 'narration', 'professional'], 
    uploadedAt: '2024-01-06',
    lastModified: '2024-01-06',
    folder: 'Audio',
    format: 'MP3'
  },
];

const AssetsView: React.FC<AssetsViewProps> = ({ theme }) => {
  // Theme variables
  const isDarkMode = theme === 'dark';
  const isExperimental = theme === 'experimental';
  const isLightMode = theme === 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'image' | 'audio'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Add glassmorphism CSS
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes assetsGlow {
        0% { opacity: 0.05; transform: scale(1); }
        50% { opacity: 0.15; transform: scale(1.02); }
        100% { opacity: 0.05; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Get unique folders
  const folders = useMemo(() => {
    const folderSet = new Set(mockAssets.map(asset => asset.folder).filter(Boolean));
    return Array.from(folderSet);
  }, []);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let filtered = mockAssets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || asset.type === filterType;
      const matchesFolder = !selectedFolder || asset.folder === selectedFolder;
      const matchesFavorites = !showFavoritesOnly || asset.favorite;
      
      return matchesSearch && matchesType && matchesFolder && matchesFavorites;
    });

    // Sort assets
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
        case 'size':
          const aSizeNum = parseFloat(a.size.replace(/[^0-9.]/g, ''));
          const bSizeNum = parseFloat(b.size.replace(/[^0-9.]/g, ''));
          comparison = aSizeNum - bSizeNum;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [searchQuery, filterType, selectedFolder, showFavoritesOnly, sortBy, sortOrder]);

  // Get file type info
  const getFileTypeInfo = (type: string) => {
    switch (type) {
      case 'video':
        return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30', icon: FileVideo };
      case 'image':
        return { color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30', icon: FileImage };
      case 'audio':
        return { color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30', icon: FileAudio };
      default:
        return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30', icon: FileVideo };
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  return (
    <div className={`min-h-screen ${
      isDarkMode ? 'bg-black text-white' : 
      isExperimental ? 'bg-black text-white' : 
      'bg-white text-gray-900'
    }`}>
      {/* Glassmorphism overlays */}
      <div className={`fixed inset-0 pointer-events-none ${
        isDarkMode ? 'bg-gradient-to-br from-purple-900/5 via-transparent to-purple-800/5' :
        isExperimental ? 'bg-gradient-to-br from-yellow-900/5 via-transparent to-yellow-800/5' :
        'bg-gradient-to-br from-blue-900/5 via-transparent to-blue-800/5'
      }`} />
      <div className={`fixed inset-0 pointer-events-none ${
        isDarkMode ? 'bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_50%)]' :
        isExperimental ? 'bg-[radial-gradient(circle_at_30%_40%,rgba(251,191,36,0.08),transparent_50%)]' :
        'bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.08),transparent_50%)]'
      }`} />
      
      {/* Header */}
      <div className={`relative backdrop-blur-xl border-b p-8 ${
        isDarkMode ? 'bg-black/30 border-purple-500/30' :
        isExperimental ? 'bg-black/30 border-yellow-400/30' :
        'bg-white border-gray-100'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <h1 className={`text-3xl font-bold drop-shadow-lg ${
              isDarkMode ? 'text-white' :
              isExperimental ? 'text-white' :
              'text-gray-900'
            }`}>Assets Library</h1>
            <p className={`text-sm drop-shadow-md ${
              isDarkMode ? 'text-purple-300/80' :
              isExperimental ? 'text-yellow-300/80' :
              'text-gray-700'
            }`}>Manage your media assets with advanced search and organization</p>
          </div>
          <div className="flex gap-3">
            <button className={`px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg flex items-center gap-2 backdrop-blur-sm border ${
              isDarkMode ? 'bg-purple-600/80 hover:bg-purple-600 text-white hover:shadow-purple-500/30 border-purple-500/30' :
              isExperimental ? 'bg-yellow-600/80 hover:bg-yellow-600 text-white hover:shadow-yellow-500/30 border-yellow-500/30' :
              'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/30 border-blue-500/30'
            }`}>
              <Upload className="w-5 h-5" />
              Upload Assets
            </button>
            <button className={`px-6 py-3 rounded-xl transition-all duration-200 font-medium flex items-center gap-2 backdrop-blur-sm border ${
              isDarkMode ? 'bg-black/40 hover:bg-black/60 border-purple-500/30 hover:border-purple-400/50 text-gray-300 hover:text-white' :
              isExperimental ? 'bg-black/40 hover:bg-black/60 border-yellow-400/30 hover:border-yellow-300/50 text-gray-300 hover:text-white' :
              'bg-white hover:bg-gray-50 border-black/30 hover:border-black/50 text-gray-700 hover:text-gray-900'
            }`}>
              <Plus className="w-5 h-5" />
              New Folder
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets, tags, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none transition-colors duration-200 border ${
                isDarkMode ? 'bg-black/40 border-purple-500/30 text-white placeholder-gray-400 focus:border-purple-400/50' :
                isExperimental ? 'bg-black/40 border-yellow-400/30 text-white placeholder-gray-400 focus:border-yellow-300/50' :
                'bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            {['all', 'video', 'image', 'audio'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filterType === type
                    ? isDarkMode ? 'bg-purple-600/80 text-white' :
                      isExperimental ? 'bg-yellow-600/80 text-white' :
                      'bg-blue-600 text-white'
                    : isDarkMode ? 'bg-gray-600/40 text-gray-300 hover:bg-gray-600/60' :
                      isExperimental ? 'bg-gray-600/40 text-gray-300 hover:bg-gray-600/60' :
                      'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Favorites Toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              showFavoritesOnly ? 'text-yellow-400 bg-yellow-400/20' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Star className="w-4 h-4" />
          </button>

          {/* Sort */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split('-');
              setSortBy(sort as any);
              setSortOrder(order as any);
            }}
            className={`px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors duration-200 border ${
              isDarkMode ? 'bg-black/40 border-purple-500/30 text-white focus:border-purple-400/50' :
              isExperimental ? 'bg-black/40 border-yellow-400/30 text-white focus:border-yellow-300/50' :
              'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
            }`}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="size-desc">Largest First</option>
            <option value="size-asc">Smallest First</option>
            <option value="type-asc">Type A-Z</option>
          </select>

          {/* View Toggle */}
          <div className={`flex gap-1 rounded-lg p-1 ${
            isDarkMode ? 'bg-gray-600/40' :
            isExperimental ? 'bg-gray-600/40' :
            'bg-gray-50 border border-gray-200'
          }`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors duration-200 ${
                viewMode === 'grid' 
                  ? isDarkMode ? 'text-purple-400 bg-purple-400/20' :
                    isExperimental ? 'text-yellow-400 bg-yellow-400/20' :
                    'text-blue-600 bg-blue-100'
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' :
                    isExperimental ? 'text-gray-400 hover:text-gray-300' :
                    'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-colors duration-200 ${
                viewMode === 'list' 
                  ? isDarkMode ? 'text-purple-400 bg-purple-400/20' :
                    isExperimental ? 'text-yellow-400 bg-yellow-400/20' :
                    'text-blue-600 bg-blue-100'
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' :
                    isExperimental ? 'text-gray-400 hover:text-gray-300' :
                    'text-gray-600 hover:text-gray-800'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100%-160px)]">
        {/* Sidebar */}
        <div className={`w-64 backdrop-blur-xl border-r p-6 ${
          isDarkMode ? 'bg-black/20 border-purple-500/30' :
          isExperimental ? 'bg-black/20 border-yellow-400/30' :
          'bg-white border-gray-200'
        }`}>
          <div className="space-y-4">
            {/* All Assets */}
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                selectedFolder === null 
                  ? isDarkMode ? 'bg-purple-600/20 text-purple-300' :
                    isExperimental ? 'bg-yellow-600/20 text-yellow-300' :
                    'bg-blue-100 text-blue-800 border border-gray-300'
                  : isDarkMode ? 'text-gray-300 hover:bg-gray-600/20' :
                    isExperimental ? 'text-gray-300 hover:bg-gray-600/20' :
                    'text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-300'
              }`}
            >
              All Assets ({mockAssets.length})
            </button>

            {/* Folders */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Folders</h3>
              <div className="space-y-1">
                {folders.map((folder) => {
                  const count = mockAssets.filter(asset => asset.folder === folder).length;
                  return (
                    <button
                      key={folder}
                      onClick={() => setSelectedFolder(folder)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                        selectedFolder === folder ? 'bg-purple-600/20 text-purple-300' : 'text-gray-300 hover:bg-gray-600/20'
                      }`}
                    >
                      {folder} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 p-8 overflow-y-auto backdrop-blur-sm ${
          isDarkMode ? 'bg-gradient-to-br from-black/10 via-transparent to-purple-900/5' :
          isExperimental ? 'bg-gradient-to-br from-black/10 via-transparent to-yellow-900/5' :
          'bg-white'
        }`}>
          {/* Stats */}
          <div className={`mb-4 text-sm ${
            isDarkMode ? 'text-gray-400' :
            isExperimental ? 'text-gray-400' :
            'text-gray-700'
          }`}>
            {filteredAssets.length} of {mockAssets.length} assets
            {selectedAssets.length > 0 && (
              <span className="ml-4 text-purple-400">
                {selectedAssets.length} selected
              </span>
            )}
          </div>

          {/* Assets Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => {
                const typeInfo = getFileTypeInfo(asset.type);
                const IconComponent = typeInfo.icon;
                const isSelected = selectedAssets.includes(asset.id);
                
                return (
                  <div
                    key={asset.id}
                    onClick={() => toggleAssetSelection(asset.id)}
                    className={`group bg-black/30 backdrop-blur-xl rounded-2xl p-5 cursor-pointer transition-all duration-300 border shadow-lg ${
                      isSelected 
                        ? 'border-purple-400/60 bg-purple-500/10 shadow-purple-500/20' 
                        : `border-purple-500/30 hover:border-purple-400/50 hover:shadow-purple-500/20`
                    } transform hover:scale-[1.02] hover:shadow-xl`}
                  >
                    {/* Glassmorphism overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-800/5 rounded-2xl pointer-events-none" />
                    
                    {/* Thumbnail/Icon */}
                    <div className={`relative aspect-video ${typeInfo.bgColor} rounded-xl mb-4 flex items-center justify-center border ${typeInfo.borderColor} group-hover:border-purple-400/50 transition-all duration-200 overflow-hidden backdrop-blur-sm`}>
                      <IconComponent className={`w-10 h-10 ${typeInfo.color} group-hover:text-purple-200 transition-colors duration-200`} />
                      
                      {/* Favorite Star */}
                      {asset.favorite && (
                        <div className="absolute top-2 left-2">
                          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                        </div>
                      )}
                      
                      {/* Duration/Format badge */}
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm shadow-lg">
                        {asset.duration || asset.format}
                      </div>
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                      
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Asset Info */}
                    <div className="relative space-y-2">
                      <h4 className="text-white text-sm font-semibold leading-tight truncate group-hover:text-purple-100 transition-colors duration-200">
                        {asset.name}
                      </h4>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`${typeInfo.color} font-medium uppercase`}>{asset.type}</span>
                        <span className="text-gray-400">{asset.size}</span>
                      </div>
                      {asset.description && (
                        <p className="text-xs text-purple-300/60 line-clamp-2 leading-relaxed">
                          {asset.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-2">
              {filteredAssets.map((asset) => {
                const typeInfo = getFileTypeInfo(asset.type);
                const IconComponent = typeInfo.icon;
                const isSelected = selectedAssets.includes(asset.id);
                
                return (
                  <div
                    key={asset.id}
                    onClick={() => toggleAssetSelection(asset.id)}
                    className={`group bg-black/30 backdrop-blur-xl rounded-xl p-4 cursor-pointer transition-all duration-300 border shadow-lg ${
                      isSelected 
                        ? 'border-purple-400/60 bg-purple-500/10 shadow-purple-500/20' 
                        : `border-purple-500/30 hover:border-purple-400/50 hover:shadow-purple-500/20`
                    } flex items-center gap-4 transform hover:scale-[1.01]`}
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 ${typeInfo.bgColor} rounded-lg flex items-center justify-center border ${typeInfo.borderColor} group-hover:border-purple-400/30 transition-all duration-200`}>
                      <IconComponent className={`w-6 h-6 ${typeInfo.color}`} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white text-sm font-medium truncate group-hover:text-purple-100 transition-colors duration-200">
                          {asset.name}
                        </h4>
                        {asset.favorite && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className={`${typeInfo.color} font-medium uppercase`}>{asset.type}</span>
                        <span>{asset.size}</span>
                        {asset.duration && <span>{asset.duration}</span>}
                        {asset.resolution && <span>{asset.resolution}</span>}
                        <span>{new Date(asset.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      {asset.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {asset.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button className="p-1 text-gray-400 hover:text-white transition-colors duration-200">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-white transition-colors duration-200">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-white transition-colors duration-200">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {filteredAssets.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">No assets found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetsView;
