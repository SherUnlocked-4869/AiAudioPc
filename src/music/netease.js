const NeteaseAPI = require('NeteaseCloudMusicApi');

class NeteaseAdapter {
  constructor() {
    this.api = NeteaseAPI;
  }

  async search(keyword, limit = 5) {
    try {
      const res = await this.api.search({ keywords: keyword, limit, type: 1 });
      if (!res.status || res.status !== 200 || !res.body?.result?.songs) return [];
      return res.body.result.songs.map(s => ({
        id: s.id,
        name: s.name,
        artist: s.artists.map(a => a.name).join('/'),
        album: s.album?.name,
        duration: s.duration,
      }));
    } catch (err) {
      console.error('[netease] search error:', err.message);
      return [];
    }
  }

  async getSongUrl(id) {
    try {
      const res = await this.api.song_url({ id, br: 320000 });
      if (!res.status || res.status !== 200 || !res.body?.data) return null;
      const song = res.body.data[0];
      return song ? { url: song.url, type: song.type, size: song.size, br: song.br } : null;
    } catch (err) {
      console.error('[netease] song_url error:', err.message);
      return null;
    }
  }

  async getLyric(id) {
    try {
      const res = await this.api.lyric({ id });
      if (!res.status || res.status !== 200) return { lrc: '', tlyric: '' };
      return {
        lrc: res.body.lrc?.lyric || '',
        tlyric: res.body.tlyric?.lyric || '',
      };
    } catch (err) {
      console.error('[netease] lyric error:', err.message);
      return { lrc: '', tlyric: '' };
    }
  }

  async recommendPlaylists(tag = '华语', limit = 5) {
    try {
      const res = await this.api.top_playlist_highquality({ cat: tag, limit });
      if (!res.status || res.status !== 200 || !res.body?.playlists) return [];
      return res.body.playlists.map(p => ({ id: p.id, name: p.name, cover: p.coverImgUrl }));
    } catch (err) {
      console.error('[netease] playlist error:', err.message);
      return [];
    }
  }

  async resolve(keyword) {
    const songs = await this.search(keyword);
    if (!songs.length) return null;
    const song = songs[0];
    const urlInfo = await this.getSongUrl(song.id);
    if (!urlInfo || !urlInfo.url) return null;
    return { ...song, url: urlInfo.url };
  }
}

module.exports = NeteaseAdapter;
