import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Album, Cloud, ListMusic, ListPlus, Play } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';

export function AlbumsPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { tracks } = useLibrary();
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  const getAlbum = (track: Track) => track.album || playerState.getTrackMetadata(track.id)?.album || '';
  const getArtist = (track: Track) => (
    track.artist ||
    playerState.getTrackMetadata(track.id)?.artist ||
    (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')
  );
  const getTitle = (track: Track) => (
    track.title ||
    playerState.getTrackMetadata(track.id)?.title ||
    (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')
  );

  const albumGroups = useMemo(() => {
    const groups = new Map<string, Track[]>();
    tracks.forEach((track) => {
      const album = getAlbum(track);
      if (!album) return;
      groups.set(album, [...(groups.get(album) || []), track]);
    });
    return Array.from(groups.entries()).map(([name, albumTracks]) => ({
      name,
      tracks: albumTracks,
      coverTrack: albumTracks.find(track => track.imageUrl || playerState.getTrackImage(track.id)) || albumTracks[0],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, playerState.metadataVersion]);

  const selectedAlbumGroup = selectedAlbum
    ? albumGroups.find(album => album.name === selectedAlbum)
    : null;

  const handlePlayAlbum = (album: string, e: MouseEvent) => {
    e.stopPropagation();
    const albumTracks = albumGroups.find(group => group.name === album)?.tracks || [];
    if (albumTracks.length > 0) {
      playerState.playTrack(albumTracks[0], albumTracks);
    }
  };

  const handleBack = () => {
    if (selectedAlbum) {
      setSelectedAlbum(null);
      return;
    }
    navigate('/library');
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            {selectedAlbumGroup ? selectedAlbumGroup.name : 'Albums'}
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {selectedAlbumGroup
              ? `${selectedAlbumGroup.tracks.length} songs in this album.`
              : `${albumGroups.length} albums in your library.`}
          </p>
        </div>
      </div>

      {selectedAlbumGroup ? (
        <div className="flex flex-col gap-1.5">
          {selectedAlbumGroup.tracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => playerState.playTrack(track, selectedAlbumGroup.tracks)}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
            >
              <span className="text-xs text-white/20 w-5 text-right md:group-hover:hidden">{idx + 1}</span>
              <button
                aria-label="Play track"
                onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedAlbumGroup.tracks); }}
                className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-white"
              >
                <Play size={13} fill="currentColor" />
              </button>
              <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                {track.imageUrl || playerState.getTrackImage(track.id) ? (
                  <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <ListMusic size={16} className="text-white/40" />
                )}
              </div>
              <div className="flex flex-col truncate flex-1">
                <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                  {getTitle(track)}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Cloud size={12} className="text-blue-400" />
                  <span className="text-xs text-white/30 truncate">{getArtist(track)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : albumGroups.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {albumGroups.map((album, i) => {
            const track = album.coverTrack;
            return (
              <div key={album.name} className="group cursor-pointer" onClick={() => setSelectedAlbum(album.name)}>
                <div className={`w-full aspect-square rounded-2xl mb-3 flex items-center justify-center border border-white/5 group-hover:border-[#f59e0b]/40 transition-all relative overflow-hidden bg-gradient-to-br`}
                  style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 20%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 10%) 100%)` }}>
                  {track?.imageUrl || playerState.getTrackImage(track.id) ? (
                    <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <Album size={64} className="text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); playerState.addToCurrentQueue(album.tracks); }} className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ hiện tại">
                      <ListPlus size={16} className="text-white" />
                    </button>
                    <button onClick={(e) => handlePlayAlbum(album.name, e)} className="w-12 h-12 bg-[#f59e0b] rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Phát album">
                      <Play size={20} fill="white" className="ml-1 text-white" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); playerState.addToNextQueue(album.tracks); }} className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ tiếp theo">
                      <ListMusic size={16} className="text-white" />
                    </button>
                  </div>
                </div>
                <p className="text-base font-semibold text-white truncate group-hover:text-[#f59e0b] transition-colors">{album.name}</p>
                <p className="text-sm text-white/40 truncate">{album.tracks.length} songs</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Album size={64} className="mb-4 text-[#f59e0b]" />
          <p>No albums found in your library.</p>
        </div>
      )}
    </div>
  );
}
