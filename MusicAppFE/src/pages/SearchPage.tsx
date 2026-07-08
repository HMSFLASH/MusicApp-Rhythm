import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Users, Music, Disc, X, Check, Play, Cloud, ListPlus } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext';;
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import type { Track } from '../hooks/useAudioPlayer';
import { useLibrary } from '../context/LibraryContext';

export function SearchPage() {
  const { jwtToken } = useAuth();
  const { playerState } = useGlobalAudio();
  const { tracks: allTracks } = useLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-5xl mx-auto pb-32">
      <AddToPlaylistModal
        isOpen={!!trackToPlaylist}
        onClose={() => setTrackToPlaylist(null)}
        jwtToken={jwtToken}
        track={trackToPlaylist}
      />

      {/* Search Input Container */}
      <div className="relative w-full mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search size={20} className="text-white/40" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or artist"
          className="w-full bg-[#111] border border-white/5 text-white text-lg rounded-2xl pl-12 pr-6 py-4 outline-none focus:bg-[#1a1a1a] focus:border-primary/50 transition-all placeholder:text-white/30 font-sans"
        />
      </div>

      {/* Filter Chips & Add Button */}
      <div className="flex flex-wrap items-center gap-3 relative">

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
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all font-semibold text-sm shadow-sm ${isOpen || selections.length > 0
                    ? 'bg-[#00E5FF] border-[#00E5FF] text-black hover:bg-[#00E5FF]/90'
                    : 'bg-transparent border-white/20 text-white hover:border-white/40'
                  }`}
              >
                <span>{displayText}</span>
                <div
                  className={`p-0.5 rounded-full transition-colors ${isOpen || selections.length > 0 ? 'hover:bg-black/20' : 'hover:bg-white/20'}`}
                  onClick={(e) => handleRemoveFilter(filterLabel, e)}
                >
                  <X size={14} strokeWidth={3} />
                </div>
              </button>

              {/* Nested Popover for this Filter */}
              {isOpen && (
                <div className="absolute top-10 left-0 w-80 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">

                  {/* Popover Search Bar */}
                  <div className="px-4 pb-3 border-b border-white/10 relative">
                    <div className="absolute inset-y-0 left-4 top-0 bottom-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-white/40" />
                    </div>
                    <input
                      type="text"
                      value={popoverSearch}
                      onChange={(e) => setPopoverSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full bg-transparent text-white text-sm outline-none pl-8 pr-2 placeholder:text-white/30"
                    />
                  </div>

                  {/* Popover Scrollable List */}
                  <div className="max-h-64 overflow-y-auto mt-2 custom-scrollbar flex flex-col">
                    {/* Dummy "(0)" items just like in the screenshot */}
                    <div className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-white/5 cursor-pointer transition-colors text-white/50">
                      <div className="w-5 h-5 rounded-[4px] border-[2px] border-[#00E5FF] bg-transparent flex items-center justify-center flex-shrink-0"></div>
                      <span className="font-medium text-sm">(0)</span>
                    </div>

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
                            className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-white/5 cursor-pointer transition-colors text-white"
                          >
                            {/* Custom Checkbox */}
                            <div className={`w-5 h-5 rounded-[4px] border-[2px] flex items-center justify-center flex-shrink-0 transition-colors ${isChecked
                                ? 'bg-[#00E5FF] border-[#00E5FF] text-black'
                                : 'bg-transparent border-[#00E5FF]'
                              }`}>
                              {isChecked && <Check size={14} strokeWidth={3} />}
                            </div>

                            <span className="font-medium text-sm tracking-wide line-clamp-1">
                              {opt} ({count})
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-colors font-medium text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add filters
          </button>

          {/* Add Filters Dropdown Menu */}
          {showAddFilters && (
            <div className="absolute top-10 left-0 w-56 bg-[#1e293b] border border-white/5 rounded-xl shadow-2xl py-2 z-40 animate-in fade-in zoom-in-95 duration-100">
              {filterOptions.filter(opt => !activeFilters.includes(opt.label)).map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFilterOption(option.label)}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-white/5 text-white transition-colors text-left"
                >
                  <div className="text-white/70">
                    {option.icon}
                  </div>
                  <span className="font-medium text-sm tracking-wide">{option.label}</span>
                </button>
              ))}

              {filterOptions.filter(opt => !activeFilters.includes(opt.label)).length === 0 && (
                <div className="px-5 py-3 text-white/50 text-sm italic">All filters active</div>
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
              <div className="flex items-center gap-2 text-white/30 text-sm">
                <div className="w-4 h-4 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Đang tìm kiếm...
              </div>
            )}

            {/* Tracks from BE */}
            {!isSearching && searchResults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Songs</h3>
                <div className="flex flex-col gap-1.5">
                  {searchResults.map((track, idx) => (
                    <div key={track.id} onClick={() => playerState.playTrack(track, searchResults)} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                      }`}>
                      <span className="text-xs text-white/20 w-5 text-right group-hover:hidden">{idx + 1}</span>
                      <button onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, searchResults); }}
                        className="hidden group-hover:flex w-5 items-center justify-center text-white">
                        <Play size={13} fill="currentColor" />
                      </button>
                      <div className="flex flex-col truncate flex-1">
                        <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                          {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
                        </span>
                        <span className="text-xs text-white/30 font-mono mt-0.5 flex items-center gap-1 truncate">
                          {track.sourceType === 'DRIVE' && <Cloud size={9} className="text-primary shrink-0" />}
                          <span className="truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setTrackToPlaylist(track); }}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                          title="Add to Playlist"
                        >
                          <ListPlus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artists (Dynamic) */}
            {(() => {
              const uniqueArtists = Array.from(new Set(searchResults.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist).filter(Boolean))) as string[];
              return uniqueArtists.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Artists</h3>
                  <div className="flex flex-wrap gap-3">
                    {uniqueArtists.map((artist, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-3 cursor-pointer transition-colors">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 70%, 30%) 0%, hsl(${(i * 47 + 80) % 360}, 90%, 20%) 100%)` }}>
                          {artist[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{artist}</p>
                          <p className="text-xs text-white/40">{searchResults.filter(t => (t.artist || playerState.getTrackMetadata(t.id)?.artist) === artist).length} songs</p>
                        </div>
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
                  <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Albums</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {uniqueAlbums.map((album, i) => {
                      const track = searchResults.find(t => t.album === album);
                      return (
                        <div key={i} className="group cursor-pointer">
                          <div className="w-full aspect-square rounded-xl mb-2 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-all relative overflow-hidden"
                            style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 20%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 10%) 100%)` }}>
                            {track?.imageUrl ? (
                              <img src={track.imageUrl} alt={album} className="w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                <Disc size={40} className="text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{album}</p>
                          <p className="text-xs text-white/40 truncate">{track?.artist || 'Unknown'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {!isSearching && searchResults.length === 0 && (
              <div className="text-white/50 flex flex-col items-center gap-4 py-16">
                <Search size={48} className="text-white/20" />
                <p>No results found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/30 text-center font-mono py-16">
            Type something to search
          </div>
        )}
      </div>

    </div>
  );
}
