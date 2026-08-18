import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Users, Music, Disc, X, Check, Play, ListPlus, Trash2, ListMusic, Download, Info } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import type { Track } from '../hooks/audioTypes';
import { useLibrary } from '../context/LibraryContext';
import { useConfirm } from '../context/ConfirmContext';
import { ActionMenu } from '../components/ActionMenu';
import { useOffline } from '../context/OfflineContext';
import { downloadTrackFile } from '../utils/downloadUtils';
import { TrackInfoModal } from '../components/TrackInfoModal';
import { useVirtualList } from '../hooks/useVirtualList';

const SEARCH_TRACK_ROW_HEIGHT = 72;

export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const { isOfflineMode, isCached } = useOffline();
  const { tracks: allTracks, deleteTrack } = useLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    containerRef: searchTracksContainerRef,
    handleScroll: handleSearchTracksScroll,
    offsetY: searchTracksOffsetY,
    totalHeight: searchTracksTotalHeight,
    visibleIndexes: searchTracksVisibleIndexes,
  } = useVirtualList({
    itemCount: searchResults.length,
    itemHeight: SEARCH_TRACK_ROW_HEIGHT,
  });

  // Debounced local search
  useEffect(() => {
    if (!searchQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      const query = searchQuery.toLowerCase();
      const results = allTracks.filter((t: Track) =>
        t.fileName.toLowerCase().includes(query) ||
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query))
      );
      setSearchResults(results);
      setIsSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, allTracks]);

  const [showAddFilters, setShowAddFilters] = useState(false);
  const addFiltersRef = useRef<HTMLDivElement>(null);

  // States for Active Filters
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // States for Popover (which filter's popover is currently open)
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Filter-specific selections (e.g. { 'Artists': ['100 gecs', 'Adele'] })
  const [filterSelections, setFilterSelections] = useState<Record<string, string[]>>({});

  // Filter-specific search query inside the popover
  const [popoverSearch, setPopoverSearch] = useState('');

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addFiltersRef.current && !addFiltersRef.current.contains(event.target as Node)) {
        setShowAddFilters(false);
      }
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterOptions = [
    { label: 'Artists', icon: <Users size={18} /> },
    { label: 'Albums', icon: <Disc size={18} /> },
    { label: 'Genres', icon: <Music size={18} /> }
  ];

  const handleSelectFilterOption = (label: string) => {
    if (!activeFilters.includes(label)) {
      setActiveFilters([...activeFilters, label]);
    }
    setShowAddFilters(false);
    setOpenPopover(label);
    setPopoverSearch('');
  };

  const handleRemoveFilter = (label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveFilters(activeFilters.filter(f => f !== label));
    if (openPopover === label) setOpenPopover(null);

    // Clear selections for this filter
    const newSelections = { ...filterSelections };
    delete newSelections[label];
    setFilterSelections(newSelections);
  };

  const toggleCheckbox = (filterLabel: string, value: string) => {
    const currentSelected = filterSelections[filterLabel] || [];
    if (currentSelected.includes(value)) {
      setFilterSelections({
        ...filterSelections,
        [filterLabel]: currentSelected.filter(v => v !== value)
      });
    } else {
      setFilterSelections({
        ...filterSelections,
        [filterLabel]: [...currentSelected, value]
      });
    }
  };

  const handleDeleteTrack = async (track: Track) => {
    const trackName = track.title || track.fileName;
    const isConfirmed = await confirm({
      title: 'Xóa bài hát',
      description: `Bạn có chắc chắn muốn xóa bài hát "${trackName}" khỏi thư viện?`,
      confirmText: 'Xóa',
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
    });

    if (!isConfirmed) return;

    const isConfirmed2 = await confirm({
      title: 'Xác nhận xóa vĩnh viễn',
      description: `Hành động này sẽ xóa vĩnh viễn bài hát "${trackName}" từ Google Drive của bạn và không thể hoàn tác. Bạn vẫn muốn tiếp tục?`,
      confirmText: 'Xóa vĩnh viễn',
      confirmColor: 'bg-red-600 text-white hover:bg-red-700 border-red-600'
    });

    if (isConfirmed2) {
      await deleteTrack(track);
    }
  };

  return (
    <div className="w-full h-full flex flex-col max-w-5xl 2xl:max-w-none mx-auto pb-28 md:pb-32 no-scrollbar">
      <AddToPlaylistModal
        isOpen={!!trackToPlaylist}
        onClose={() => setTrackToPlaylist(null)}
        isAuthenticated={isAuthenticated}
        track={trackToPlaylist}
      />

      {/* Search Input Container */}
      <div className="relative w-full mb-5">
        <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none">
          <Search size={19} className="text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by song name, artist, or album..."
          className="w-full bg-[#0c1626]/80 border border-white/[0.08] focus:border-primary/50 text-white text-sm sm:text-base rounded-2xl pl-12 pr-4 sm:pr-6 py-3.5 outline-none transition-all placeholder:text-slate-500 font-sans shadow-lg focus:shadow-[0_0_25px_rgba(0,245,255,0.15)] backdrop-blur-xl"
        />
      </div>

      {/* Filter Chips & Add Button */}
      <div className="flex flex-wrap items-center gap-2.5 relative">

        {/* Active Filter Chips */}
        {activeFilters.map(filterLabel => {
          const isOpen = openPopover === filterLabel;
          const selections = filterSelections[filterLabel] || [];
          const displayText = selections.length > 0
            ? `${filterLabel}: ${selections.length} selected`
            : `${filterLabel} Any`;

          return (
            <div key={filterLabel} className="relative" ref={isOpen ? popoverRef : null}>
              <button
                onClick={() => {
                  setOpenPopover(isOpen ? null : filterLabel);
                  setPopoverSearch('');
                }}
                className={`flex max-w-[calc(100vw-2rem)] items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all text-xs font-semibold shadow-sm ${isOpen || selections.length > 0
                    ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_12px_rgba(0,245,255,0.2)]'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
              >
              <span className="truncate">{displayText}</span>
                <div
                  className={`p-0.5 rounded-md transition-colors ${isOpen || selections.length > 0 ? 'hover:bg-primary/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => handleRemoveFilter(filterLabel, e)}
                >
                  <X size={13} strokeWidth={2.5} />
                </div>
              </button>

              {/* Nested Popover for this Filter */}
              {isOpen && (
                <div className="absolute top-10 left-0 w-80 max-w-[calc(100vw_-_2rem)] bg-[#0c1626] border border-white/10 rounded-2xl shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col backdrop-blur-2xl">

                  {/* Popover Search Bar */}
                  <div className="px-3.5 pb-2.5 border-b border-white/[0.06] relative">
                    <div className="absolute inset-y-0 left-3.5 top-0 bottom-2.5 flex items-center pointer-events-none">
                      <Search size={15} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={popoverSearch}
                      onChange={(e) => setPopoverSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full bg-transparent text-slate-200 text-xs outline-none pl-7 pr-2 placeholder:text-slate-500 font-mono"
                    />
                  </div>

                  {/* Popover Scrollable List */}
                  <div className="max-h-64 overflow-y-auto mt-2 no-scrollbar flex flex-col">
                    {(() => {
                      let options: string[] = [];
                      if (filterLabel === 'Artists') options = Array.from(new Set(allTracks.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist).filter(Boolean))) as string[];
                      else if (filterLabel === 'Albums') options = Array.from(new Set(allTracks.map(t => t.album).filter(Boolean))) as string[];
                      else if (filterLabel === 'Genres') options = Array.from(new Set(allTracks.map(t => t.genre).filter(Boolean))) as string[];

                      const filteredOptions = options.filter(opt => opt.toLowerCase().includes(popoverSearch.toLowerCase()));

                      return filteredOptions.map((opt, idx) => {
                        const isChecked = selections.includes(opt);
                        let count = 0;
                        if (filterLabel === 'Artists') count = allTracks.filter(t => (t.artist || playerState.getTrackMetadata(t.id)?.artist) === opt).length;
                        else if (filterLabel === 'Albums') count = allTracks.filter(t => t.album === opt).length;
                        else if (filterLabel === 'Genres') count = allTracks.filter(t => t.genre === opt).length;

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleCheckbox(filterLabel, opt)}
                            className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-white/[0.05] cursor-pointer transition-colors text-slate-200 text-xs"
                          >
                            {/* Custom Checkbox */}
                            <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isChecked
                                ? 'bg-primary border-primary text-slate-950 font-bold'
                                : 'bg-transparent border-slate-600'
                              }`}>
                              {isChecked && <Check size={13} strokeWidth={3} />}
                            </div>

                            <span className="font-medium tracking-wide line-clamp-1 flex-1">
                              {opt}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {count}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Filters Button & Dropdown */}
        <div className="relative" ref={addFiltersRef}>
          <button
            onClick={() => setShowAddFilters(!showAddFilters)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-all font-semibold text-xs shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add filters
          </button>

          {/* Add Filters Dropdown Menu */}
          {showAddFilters && (
            <div className="absolute top-10 left-0 w-52 max-w-[calc(100vw-2rem)] bg-[#0c1626] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-2xl">
              {filterOptions.filter(opt => !activeFilters.includes(opt.label)).map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFilterOption(option.label)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.06] text-slate-200 hover:text-white transition-colors text-left text-xs font-medium"
                >
                  <div className="text-slate-400">
                    {option.icon}
                  </div>
                  <span className="tracking-wide">{option.label}</span>
                </button>
              ))}

              {filterOptions.filter(opt => !activeFilters.includes(opt.label)).length === 0 && (
                <div className="px-4 py-2.5 text-slate-500 text-xs italic font-mono">All filters active</div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Search Results */}
      <div className="mt-8 flex-1">
        {searchQuery ? (
          <div className="flex flex-col gap-6">
            {/* Loading state */}
            {isSearching && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Searching library...
              </div>
            )}

            {/* Tracks from BE */}
            {!isSearching && searchResults.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-3">Songs ({searchResults.length})</h3>
                <div
                  ref={searchTracksContainerRef}
                  onScroll={handleSearchTracksScroll}
                  className="relative w-full"
                  style={{ height: searchTracksTotalHeight }}
                >
                  <div
                    className="absolute inset-x-0 top-0 will-change-transform"
                    style={{ transform: `translateY(${searchTracksOffsetY}px)` }}
                  >
                    {searchTracksVisibleIndexes.map((idx) => {
                      const track = searchResults[idx];
                      if (!track) return null;
                      const isActive = playerState.currentTrack?.id === track.id;
                      return (
                        <div
                          key={track.id}
                          style={{ height: SEARCH_TRACK_ROW_HEIGHT }}
                          className="relative"
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (isOfflineMode && !isCached(track)) return;
                              playerState.playTrack(track, searchResults);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isOfflineMode && !isCached(track)) return;
                                playerState.playTrack(track, searchResults);
                              }
                            }}
                            className={`flex h-[64px] items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 group cursor-pointer ${
                              isOfflineMode && !isCached(track)
                                ? 'opacity-40 grayscale pointer-events-none'
                                : isActive
                                ? 'bg-primary/15 border-primary/30 text-primary shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                                : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] hover:border-primary/25 backdrop-blur-md'
                            }`}
                          >
                            <div className="w-5 text-center shrink-0">
                              {isActive && playerState.isPlaying ? (
                                <div className="flex items-end justify-center gap-0.5 h-3">
                                  <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                                  <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                                  <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                                </div>
                              ) : (
                                <span className="hidden sm:block text-[11px] font-mono text-slate-500">{idx + 1}</span>
                              )}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, searchResults); }}
                              className="hidden lg:group-hover:flex w-5 items-center justify-center text-primary pointer-events-auto">
                              <Play size={13} fill="currentColor" />
                            </button>
                            <div className="flex flex-col truncate flex-1 pr-2">
                              <span className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-100'}`}>
                                {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 truncate">
                                {track.sourceType === 'DRIVE' && (
                                  <span className="inline-flex items-center gap-0.5 text-primary text-[10px] bg-primary/10 px-1 py-0.2 rounded border border-primary/20 shrink-0">
                                    Drive
                                  </span>
                                )}
                                <span className="truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                              </span>
                            </div>
                            <ActionMenu
                              ariaLabel={`Song actions for ${track.title || track.fileName}`}
                              buttonClassName="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              actions={[
                                { label: t('tracks.info', 'Info'), icon: <Info size={14} />, onSelect: () => setInfoTrack(track) },
                                { label: t('tracks.addToPlaylist', 'Add to Playlist'), icon: <ListPlus size={14} />, onSelect: () => setTrackToPlaylist(track) },
                                ...(track.sourceType !== 'LOCAL'
                                  ? [{ label: t('tracks.downloadFile', 'Download File'), icon: <Download size={14} />, onSelect: () => downloadTrackFile(track) },
                                     { label: t('tracks.delete', 'Delete'), icon: <Trash2 size={14} />, tone: 'danger' as const, onSelect: () => void handleDeleteTrack(track) }]
                                  : []),
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Artists (Dynamic) */}
            {(() => {
              const uniqueArtists = Array.from(new Set(searchResults.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist).filter(Boolean))) as string[];
              return uniqueArtists.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-3">Artists</h3>
                  <div className="flex flex-wrap gap-3">
                    {uniqueArtists.map((artist, i) => (
                      <div 
                        key={i} 
                        onClick={() => navigate('/artists', { state: { selectedArtist: artist } })}
                        className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-emerald-500/40 rounded-2xl px-4 py-3 cursor-pointer transition-all duration-300 group w-full sm:w-auto sm:min-w-[200px] gap-4 backdrop-blur-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold font-display shrink-0 border border-white/10 shadow-sm"
                            style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 70%, 20%) 0%, hsl(${(i * 47 + 80) % 360}, 90%, 12%) 100%)` }}>
                            {artist[0]}
                          </div>
                          <div className="truncate">
                            <p className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">{artist}</p>
                            <p className="text-[11px] font-mono text-slate-400">{allTracks.filter(t => (t.artist || playerState.getTrackMetadata(t.id)?.artist) === artist).length} songs</p>
                          </div>
                        </div>
                        <ActionMenu
                          ariaLabel={`Artist actions for ${artist}`}
                          buttonClassName="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 hover:scale-105 flex items-center justify-center transition-all shadow-md shrink-0"
                          actions={[
                            {
                              label: 'Play',
                              icon: <Play size={13} fill="currentColor" />,
                              onSelect: () => {
                                const artistTracks = allTracks.filter(t => t.artist === artist || playerState.getTrackMetadata(t.id)?.artist === artist || t.fileName?.startsWith(artist + ' - '));
                                if (artistTracks.length > 0) playerState.playTrack(artistTracks[0], artistTracks);
                              },
                            },
                            {
                              label: 'Add to Queue',
                              icon: <ListPlus size={14} />,
                              onSelect: () => playerState.addToCurrentQueue(allTracks.filter(t => t.artist === artist || playerState.getTrackMetadata(t.id)?.artist === artist || t.fileName?.startsWith(artist + ' - '))),
                            },
                            {
                              label: 'Play Next',
                              icon: <ListMusic size={14} />,
                              onSelect: () => playerState.addToNextQueue(allTracks.filter(t => t.artist === artist || playerState.getTrackMetadata(t.id)?.artist === artist || t.fileName?.startsWith(artist + ' - '))),
                            },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Albums (Dynamic) */}
            {(() => {
              const uniqueAlbums = Array.from(new Set(searchResults.map(t => t.album).filter(Boolean)));
              return uniqueAlbums.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-3">Albums</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 4k:grid-cols-10 gap-3.5 md:gap-4.5">
                    {uniqueAlbums.map((album, i) => {
                      const track = searchResults.find(t => t.album === album);
                      const albumTracks = allTracks.filter(t => t.album === album || playerState.getTrackMetadata(t.id)?.album === album);
                      return (
                        <div key={i} className="group cursor-pointer p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-md hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)]" onClick={() => navigate('/albums', { state: { selectedAlbum: album } })}>
                          <div className="w-full aspect-square rounded-xl mb-2 flex items-center justify-center border border-white/5 relative overflow-hidden shadow-md"
                            style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 15%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 8%) 100%)` }}>
                            {track?.imageUrl ? (
                              <img src={track.imageUrl} alt={album} className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center opacity-30 text-amber-400">
                                <Disc size={40} />
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ActionMenu
                                ariaLabel={`Album actions for ${album}`}
                                buttonClassName="h-8 w-8 rounded-full bg-amber-500 text-slate-950 hover:scale-110 flex items-center justify-center shadow-lg transition-all"
                                actions={[
                                  { label: 'Play', icon: <Play size={13} fill="currentColor" />, onSelect: () => albumTracks.length > 0 && playerState.playTrack(albumTracks[0], albumTracks) },
                                  { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(albumTracks) },
                                  { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(albumTracks) },
                                ]}
                              />
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">{album}</p>
                          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{track?.artist || 'Unknown'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {!isSearching && searchResults.length === 0 && (
              <div className="text-slate-500 flex flex-col items-center gap-3 py-16 font-mono text-sm">
                <Search size={44} className="text-slate-600" />
                <p>No results found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-center font-mono text-xs py-16">
            Type something to search tracks, artists, or albums
          </div>
        )}
      </div>

      {infoTrack && (
        <TrackInfoModal 
          track={infoTrack} 
          trackMetadata={playerState.getTrackMetadata(infoTrack.id)}
          onClose={() => setInfoTrack(null)} 
        />
      )}
    </div>
  );
}
