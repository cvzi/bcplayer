// ==UserScript==
// @name        BCPlayerLib
// @namespace   cuzi
// @oujs:author cuzi
// @description Play bandcamp music.
// @icon        data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwAQMAAABtzGvEAAAABlBMVEUAAAAclZU8CPpPAAAAAXRSTlMAQObYZgAAAFZJREFUeF6N0DEKAzEMBMBAinxbT/NT9gkuVRg7kCFwqS7bTCVW0uOPPOvDK2hsnELQ2DiFoLFxCkFj4xSC+UMwYGBhYkDRwsRAXfdsBHW9r5HvJ27yBmrWa3qFBFkKAAAAAElFTkSuQmCC
// @version     2
// @license     GNUGPL
// @include     /^https?:\/\/.*bandcamp\..*$/
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.7/jquery.min.js
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_addStyle
// @grant       unsafeWindow
// ==/UserScript==
"use strict";

var doOnceAfterDelay = (function(){
  var to = {};
  return function(id, cb, wait){
    if(id in to) {
      clearTimeout(to[id]);
    }
    to[id] = setTimeout(cb, wait);
  };
})();


function BCLibrary() {

  var libversion = false;
  var lastlibversion = false;
  var allTracks;
  var allAlbums;
  var allBands;
    
  var load = function() {
    libversion = parseInt(GM_getValue("libversion",Number.MIN_SAFE_INTEGER),10);
    if(lastlibversion == libversion) return;
    allTracks = JSON.parse(GM_getValue("tracks","{}"));
    allAlbums = JSON.parse(GM_getValue("albums","{}"));
    allBands = JSON.parse(GM_getValue("bands","{}"));
    lastlibversion = libversion;
  };
    
  var save = function() {
    if(libversion === false) {
      throw Error("BCLibrary: save() cannot be called before load()");
    }
    libversion++;
    
    if(libversion == Number.MAX_SAFE_INTEGER) {
      libersion = Number.MIN_SAFE_INTEGER;
    }
    GM_setValue("libversion",libversion);
    GM_setValue("tracks",JSON.stringify(allTracks));
    GM_setValue("albums",JSON.stringify(allAlbums));
    GM_setValue("bands",JSON.stringify(allBands));
    lastlibversion++;
  };
  
  var addBand = function(id,name) {
    load();
    
    if(allBands[id]) {
      return;
    }
    
    allBands[id] = {
      "id" : id,
      "name" : name,
      "albums" : []
    };
    
    save();
  };
  
  var addAlbum = function(albumobj) {
    load();
      
    if(allAlbums[albumobj.id]) {
      return;
    }
    
    // Band exists?
    if(!allBands[albumobj.current.band_id]) {
      addBand(albumobj.current.band_id,albumobj.artist);
    }
    
    allBands[albumobj.current.band_id].albums.push(albumobj.id);
    
    allAlbums[albumobj.id] = {};
    var keys = ['id','album_id','artFullsizeUrl','artThumbURL','current.about','current.credits','current.publish_date','current.release_date','current.title','url'];
    for(var i = 0; i < keys.length; i++) {
      var subkeys = keys[i].split(".");
      var c = albumobj[subkeys[0]];
      for(var j = 1; j < subkeys.length; j++) {
        c = c[subkeys[j]];
      }
      allAlbums[albumobj.id][subkeys.pop()] = c;
    }
    
    allAlbums[albumobj.id].tracks = [];
    allAlbums[albumobj.id].totaltracks = albumobj.trackinfo.length;
    
    save();
  };
  
  var addDegAlbum = function(id,albumobj) { // Add a temporary album that will be overwritten as soon as a track is added from the actual album page
    load();
      
    if(allAlbums[id]) {
      return;
    }
    
    // Band exists?
    if(!allBands[albumobj.current.band_id]) {
      addBand(albumobj.current.band_id,albumobj.artist);
    }
    
    allBands[albumobj.current.band_id].albums.push(id);
    
    allAlbums[id] = {};
    var keys = ['artFullsizeUrl','artThumbURL','current.publish_date','current.release_date'];
    for(var i = 0; i < keys.length; i++) {
      var subkeys = keys[i].split(".");
      var c = albumobj[subkeys[0]];
      for(var j = 1; j < subkeys.length; j++) {
        c = c[subkeys[j]];
      }
      allAlbums[id][subkeys.pop()] = c;
    }
    allAlbums[id].degenerated = true;
    allAlbums[id].title = albumobj.albumtitle;
    allAlbums[id].id = id;
    allAlbums[id].album_id = id;
    allAlbums[id].tracks = [];
    allAlbums[id].totaltracks = 1;
    var urlparts = albumobj.url.split("/");
    allAlbums[id].url = urlparts[0]+"//"+urlparts[2]+albumobj.album_url
    
    save();
  };
  var addFakeAlbum = function(id,albumobj) { // Add a fake album for single songs
    load();
      
    if(allAlbums[id]) {
      return;
    }
    
    // Band exists?
    if(!allBands[albumobj.current.band_id]) {
      addBand(albumobj.current.band_id,albumobj.artist);
    }
    
    allBands[albumobj.current.band_id].albums.push(id);
    
    allAlbums[id] = {};
    var keys = ['artFullsizeUrl','artThumbURL','current.about','current.credits','current.publish_date','current.release_date','url'];
    for(var i = 0; i < keys.length; i++) {
      var subkeys = keys[i].split(".");
      var c = albumobj[subkeys[0]];
      for(var j = 1; j < subkeys.length; j++) {
        c = c[subkeys[j]];
      }
      allAlbums[id][subkeys.pop()] = c;
    }
    allAlbums[id].fake = true;
    allAlbums[id].title = albumobj.current.title;
    allAlbums[id].id = id;
    allAlbums[id].album_id = id;
    allAlbums[id].tracks = [];
    allAlbums[id].totaltracks = 1;
    
    save();
  };
  
  // Public
  // ######
  
  this.toString = function() {
    return "[Object Library: Version-"+libversion+"]";
  };
  
  this.trackExists = function(id) {
    load();
    if(allTracks[id]) {
      return true;
    } 
    return false;
  };
  
  this.addTrack = function(trackobj,albumobj,lyrics,cb) {
    load();
    
    // Already exists?
    if(this.trackExists(trackobj.id)) {
      cb(true);
    }
    
    // Are we on an album or single track page?
    if(albumobj.id == trackobj.id) {
       // Single track page => albumobj is actually NOT a album obj
       albumobj.id = null; 
    }
    
    if(albumobj.id !== null) {
      // Album exists?
      if(!allAlbums[albumobj.id]) {
        addAlbum(albumobj); // Add album
      } else if(allAlbums[albumobj.id].degenerated) {
        // Overwrite temporary album
        delete allAlbums[albumobj.id];
        addAlbum(albumobj); // Add album
      }
    } else { // Single track page
       if(albumobj.current.album_id !== null) {
         // Single track page BUT there is a album somewhere. Add a temporary album for now.
         albumobj.id = albumobj.current.album_id;
         addDegAlbum(albumobj.current.album_id,albumobj);
       } else {
         // Single track page and NO album somewhere. Add a fake album.
         albumobj.id = -trackobj.id;
         albumobj.current.album_id = -trackobj.id;
         addFakeAlbum(-trackobj.id,albumobj); // negative track id as album id
       }
    }
    
    // Add the track to album
    allAlbums[albumobj.id].tracks.push(trackobj.id);
    trackobj.band_id = albumobj.current.band_id;
    trackobj.album_id = albumobj.id;

    // Add track    
    allTracks[trackobj.id] = {};
    var keys = ['id','album_id','band_id','duration','file','title','track_num','has_lyrics'];
    for(var i = 0; i < keys.length; i++) {
      var subkeys = keys[i].split(".");
      var c = trackobj[subkeys[0]];
      for(var j = 1; j < subkeys.length; j++) {
        c = c[subkeys[j]];
      }
      allTracks[trackobj.id][subkeys.pop()] = c;
    }
    
    if(trackobj.has_lyrics && $.trim(lyrics)) {
      allTracks[trackobj.id]['lyrics'] = $.trim(lyrics);
    }
    if(!trackobj.track_num) {
     allTracks[trackobj.id]['track_num'] = 1;
    }
    

    save();
    cb(true);
  };
  
  this.removeTrack = function(id,cb) {
    load();
    if(!this.trackExists(id)) {
      cb(true);
    }    
    
    // Will the album be empty?
    if(allTracks[id].album_id && 1 === allAlbums[allTracks[id].album_id].tracks.length)  {
      // Yes - But will the band also have no albums?
      if(allTracks[id].band_id && 1 === allBands[allTracks[id].band_id].albums.length) {
        // Yes - Delete band
        delete allBands[allTracks[id].band_id];
      }
      // Delete album
      delete allAlbums[allTracks[id].album_id];
    }
    
    // Delete Track    
    delete allTracks[id];
  
    save();
    cb(true);
  };
  
  this.getAllTracks = function() {
    load();
    var result = [];
    for(var tid in allTracks) {
      result.push(this.getTrackById(tid));
    }
    return result;
  };
  
  this.getTrackById = function(tid) {
    if(!(tid in allTracks)) {
      return false;
    }
    var trk = allTracks[tid];
    var alb = allAlbums[trk.album_id];
    var bnd = allBands[trk.band_id];
    return {
      "id" : tid,
      "duration" : trk.duration,
      "file" : trk.file,
      "lyrics" : trk.lyrics,
      "title" : trk.title,
      "track_num" : trk.track_num, 
      "band" : {
        "id" : trk.band_id,
        "albums" : bnd.albums,
        "title" : bnd.name,
        "record" : bnd // Link to the original database entry
      },
      "album" : {
        "id" : trk.album_id,
        "about" : alb.about,
        "cover" : alb.artFullsizeUrl,
        "credits" : alb.credits,
        "publish_date" : alb.publish_date,
        "release_date" : alb.release_date,
        "title" : alb.title,
        "thumb" : alb.artThumbURL,
        "totaltracks" : alb.totaltracks,
        "tracks" : alb.tracks,
        "url" : alb.url,
        "record" : alb  // Link to the original database entry
      },
      "record" : trk // Link to the original database entry
    };
  }; 
  
}
function BCPlayer(Lib,id) {
  if(!(Lib instanceof BCLibrary)) {
    throw new Error("BCPlayer needs a BCLibrary!");
  }

  var mainWindow;
  var columns = [{ // Default column format
      title: "Name",
      key: "title"
    },
    {
      title: "#",
      get: function(track) { return ""+track.track_num+"/"+track.album.totaltracks; }
    },
    {
      title: "Album",
      key: "album.title"
    },
    {
      title: "Artist",
      key: "band.title"
  }];
  
  var playlistFormatter = function(track) { // Default playlist entry format
    return "" + track.band.title + " - " + track.title; 
  };
  
  var searchString = false;
  
  this.playing = false;
  
  var playlist;
  var playlist_index;
  
  var load = function() {
    playlist = JSON.parse(GM_getValue("playlist","[]"));
    playlist_index = JSON.parse(GM_getValue("playlist_index","-1"));
  };
    
  var save = function() {
    GM_setValue("playlist",JSON.stringify(playlist));
    GM_setValue("playlist_index",JSON.stringify(playlist_index));
  };
  
  load();
  
  var speaker = {
    "tag" : $("<audio></audio>"),
    "tid" : -1
  };
  
  var events = {
    'enqueue' : function(ev) {
      var self = ev.data;
      var tid = parseInt($(this.parentNode).data("tid"),10);
      self.addToPlaylist(tid,-1);
    },
    'play' : function(ev) {
      var self = ev.data;
      self.play();      
    },
    'pause' : function(ev) {
      var self = ev.data;
      self.pause();     
      self.refresh(2);      
    },
    'playFromPlaylist' : function(ev) {
      var self = ev.data;
      var index = parseInt($(this.parentNode).data("index"),10);
      self.play(index);
    },
    'removeFromPlaylist' : function(ev) {
      var self = ev.data;
      var index = parseInt($(this.parentNode).data("index"),10);
      self.removeFromPlaylist(index);
    },
    'songEnded' : function(ev) {
      var self = ev.data;
      self.playing = false;
      self.next();
    },
    'search' : function(ev) {
      var self = ev.data;
      self.filter($(this).val());
    }
  
  };
    
  // Public
  // ######
  
  this.toString = function() {
    return "[Object Player: #"+id+"]";
  };
  
  this.getLibrary = function() {
    return Lib;
  };

  this.getMainWindow = function() {
    if(!mainWindow) {
      mainWindow = $('\
      <div id="'+id+'">\
        <div class="status"> Search: </div>\
        <div class="playlist">\
          <ol class="playlistol">\
          </ol>\
        </div>\
        <div class="library">\
          <table>\
            <thead>\
              <tr class="tablehead"></tr>\
            </thead>\
            <tbody>\
            </tbody>\
          </table>\
        </div>\
      </div>');
      
      var searchfield = $('<input class="searchfield" name="search" type="text" value="">');
      searchfield.on("keyup",this,function(ev) {
        doOnceAfterDelay("searchfieldkeyup",function() {
          events.search.call(searchfield[0],ev);
        },400);
      });
      mainWindow.find(".status").append(searchfield);
    }
    return mainWindow;
  };
  
  this.parseSearch = function(s) {
    // Returns a filter object with one function match()
  
    // No search string, always return true
    if(!s) {
      return {match: function() {return true; } };
    }

    s = s.toLowerCase();    
  
    // No special magic words, just a substring in string test
    if(s.indexOf(":") == -1) {
      return {
        match: function(track) {
          return track.title.toLowerCase().indexOf(s) != -1 || track.band.title.toLowerCase().indexOf(s) != -1 || track.album.title.toLowerCase().indexOf(s) != -1;
        } 
      };
    }

    // Everything beyond this point is for searching with magic words.
    
    
    // Example search string: "work artist :Gang starr album :Moment"
    // Search for a song where the artist contains "Gang starr" AND the album contains "Moment"
    // AND one of artist,album or songtitle contain "work".
    
    var SearchFunction = function(keys) {
       // this class parses the cut-up search string and the attribute keys
       var keys = keys;
       var str = [];

       this.push = function(v) {
         str.push(v);
       };
       
       var searchStr; // Evaluated from "str"
       var subkeys = []; // Evaluated from "keys"
       
       this.match = function(track) {
         for(var i = 0; i < subkeys.length; i++) { // foreach key
           var c = track[subkeys[i][0]];
           for(var j = 1; j < subkeys[i].length; j++) { // get the actual data for this key
             c = c[subkeys[i][j]];
           }
           if((""+c).toLowerCase().indexOf(searchStr) != -1) { // check for a match or continue
             return true;
           }
         }
         return false;
       };  
       
       this.eval = function() {
         if(str.length > 0) {
           // Search string
           searchStr = str.join(" ");
           
           // Extract subkeys
           for(var i = 0; i < keys.length; i++) {
             subkeys.push(keys[i].split("."));
           }           
           
         } else {
           this.match = function() { // Overwrite with TRUE function
             return true;
           };
         }
       };
    };
    
    var magicword = {
      "all" : new SearchFunction(["title","album.title","band.title"]),
      "artist" : new SearchFunction(["band.title"]),      
      "album" : new SearchFunction(["album.title"]), 
      "title" : new SearchFunction(["title"])
    };
    // Aliases:
    magicword.band = magicword.artist;
    magicword.performer = magicword.artist;
    magicword.name = magicword.title;
    magicword.song = magicword.title;
    
    var active = magicword.all; // Default
    var parts = s.split(/\s*(:)\s*|\s/).map($.trim); // Cut the string up into "tokens"
    for(var i = 0; i < parts.length; i++) {
      if(parts[i] && parts[i] in magicword) {
        if((i+1) < parts.length && parts[i+1] == ":") { // magic words must be followed by a :
          active = magicword[parts[i]];
          i++;
        }
      } else if(parts[i]){
        active.push(parts[i]);
      }
    }
    
    for(var word in magicword) {
      magicword[word].eval();
    }
    
    
    return {
      match : function(track) {

        for(var word in magicword) {
          if(!magicword[word].match(track)) {
             return false;
          }
        }
        return true;
      }
  
    };
  
  };
  
  
  this.refresh = function(what,noScroll) {
    // what:
    // 0/false/null/undefined -> refresh all
    // 1 -> only library
    // 2 -> only playlist
    
    // Library
    if(!what || 1 === what) {
      var scrollPosition = mainWindow.find(".library").scrollTop();  // Save scrollbar positon
      var tracks = Lib.getAllTracks();
      mainWindow.find(".library tbody").html("");
      var filter = this.parseSearch(searchString);
      for(var i = 0; i < tracks.length && i < 1000; i++) {
        if(!filter.match(tracks[i])) {
          continue;
        }
        console.log(tracks[i]);
      
        var tr = $("<tr></tr>");
        var td_ctrl = $('<td class="ctrl" data-tid="'+tracks[i].id+'"></td>');
        var box_enqueue = $('<div title="Add to playlist" class="enqueue">+</div>').click(this,events.enqueue);
        tr.append(td_ctrl.append(box_enqueue));
        tr.appendTo(mainWindow.find(".library tbody"));
        for(var j = 0; j < columns.length; j++) {
          var td = $("<td></td>");
          if(columns[j].get) {
            td.html(columns[j].get(tracks[i]));
          } else {
            if(columns[j].key.indexOf(".") != -1) {
              var keys = columns[j].key.split(".");
              var c = tracks[i];
              for(var k = 0; k < keys.length; k++) {
                c = c[keys[k]];
              }
              td.html(c);
            } else {
              td.html(tracks[i][columns[j].key]);
            }
          }
          if(columns[j].click) {
            td.click(this,columns[j].click);
          } 
          if(columns[j].dblclick) {
            td.dblclick(this,columns[j].dblclick);
          } 
          if(columns[j].mouseenter) {
            td.mouseenter(this,columns[j].mouseenter);
          }
          if(columns[j].mouseleave) {
            td.mouseleave(this,columns[j].mouseleave);
          } 
          tr.append(td);
        } 
        if(999 == i) {
          tr = $("<tr></tr>");
          tr.appendTo(mainWindow.find(".library tbody"));
          tr.append($("<td colspan=\"3\">More...</td>"));
          
        }
      }
      if(!noScroll) {
        mainWindow.find(".library").scrollTop(scrollPosition);  // Restore scrollbar positon
      }
    }
    // Playlist
    if(!what || 2 === what) {
      mainWindow.find(".playlistol").html("");
      for(var i = 0; i < playlist.length; i++) {
        var tid = playlist[i];
        var track = Lib.getTrackById(tid);
        if(!track) { // Remove not existing tracks from playlist 
          playlist.splice(i, 1);
          i--;
          continue;
        }
        var li = $("<li></li>");
        var ctrl = $('<span class="ctrl" data-tid="'+tid+'" data-index="'+i+'"></span>');
        li.html(playlistFormatter(track));
        li.prepend(ctrl);
        li.appendTo(mainWindow.find(".playlistol"));
        if(speaker.tid == tid && i == playlist_index) {
          if(this.playing) {
            var box_playing = $('<span class="box playing">&#128266;</span>').click(this,events.pause);
            ctrl.append(box_playing);
          } else {
            var box_pause = $('<span class="box pause playingspinner">&#x1f52f;</span>').click(this,events.play);
            ctrl.append(box_pause );
          }
        } else {
          var box_play = $('<span class="box play">&#9654;</span>').click(this,events.playFromPlaylist);
          ctrl.append(box_play);
        }
        var box_remove = $('<span class="box remove">&cross;</span>').click(this,events.removeFromPlaylist);
        ctrl.append(box_remove);
      }
      
      // Scroll to active
      if(this.playing && !noScroll) {
        this.scollPlaylistTo(playlist_index);
      }

    }
    
    
  };
  
  this.setColumns = function(cols) {
    // cols = [ {title: "Title", key: track.band.name, get: function(track) {  return track.duration;  }, } ,...  ] 
    var th = $("<th></th>");
    mainWindow.find(".tablehead").append(th);
    for(var i = 0; i < cols.length; i++) {
      cols[i].th = $("<th></th>").html(cols[i].title);
      mainWindow.find(".tablehead").append(cols[i].th);
    }  
    columns = cols;
    this.refresh(1);
  };
  this.setPlaylistFormatter = function(fct) {
    playlistFormatter = fct;
    this.refresh(2);
  };
  
  this.scollPlaylistTo = function(index) {
    var pl = mainWindow.find(".playlist");
    var li = pl.find("li").eq(index);
    
    var pos = li.position();
    if(!pos) return;

    var top = parseInt(pos.top,10);
    var scroll = pl.scrollTop();
    var height = pl.height();
       
    if(top > height) {
      //pl.scrollTop( scroll + (top-height) );
      pl.animate({'scrollTop':scroll + (top-height)},400,"swing");
    } else if(top < 0) {
      //pl.scrollTop( scroll + top - li.height() - 5 );
      pl.animate({'scrollTop':scroll + top - li.height() - 5},400,"swing");
    } else {
      // It is already visible
    }
  
  }  
  
  this.addToPlaylist = function(tid,index) {
    load();
    if(-1 == index) { // Add to end of list
      playlist.push(tid);
      index = playlist.length-1;
    } else {
      playlist.splice(index, 0, tid);
    }
    save();    
    this.refresh(2,true);
    this.scollPlaylistTo(index);
  };
  
  this.removeFromPlaylist = function(index) {
    load();
    playlist.splice(index, 1);
    save();    
    this.refresh(2);
  };
  
  this.next = function() {
    load();
    playlist_index++;
    save();
    this.play();
  };
  
  this.playAt = function(pos) {
    load();
    this.play(playlist_index,pos);
  };
  
  this.play = function(index,pos) {   
    load();
    
    if(0 === playlist.length) {
      return this.pause();
    }
    
    if(index != null) {
      playlist_index = index;
    }
    
    if(playlist_index < 0) {
      playlist_index = 0;
    }
    
    if(playlist_index > playlist.length-1) {
      playlist_index = 0;
    }
    
 
    var tid = playlist[playlist_index];
    var track = Lib.getTrackById(tid);
    // Check whether the track exists or found the next existing one
    while(!track && playlist_index < playlist.length && playlist_index >= 0) {
      // Remove non existing track
      playlist.splice(playlist_index, 1);
      if(playlist_index == playlist.length) { // This is the last song or everything below the song was deleted, so now look above
        playlist_index--;
        if(playlist_index == -1) {
          break; // No tracks found
        }
      }
      tid = playlist[playlist_index];
      track = Lib.getTrackById(tid);
    }
    if(!track) { // All tracks are not existing? well then stop playing
      return this.pause();
    }
    
    // Stop native bandcamp player
    if(unsafeWindow.Cookie && unsafeWindow.Cookie.CommChannel) {
      var _comm = new unsafeWindow.Cookie.CommChannel("playlist");
      _comm.send("stop");
      _comm = null;
    }
    
    if(speaker.tid == tid && speaker.tag[0].currentTime > 0.0) {
      // It was just paused
      speaker.tag[0].play();
      this.playing = true;
      this.refresh();
      return;    
    }
    
    
    speaker.tag.attr("src",track.file["mp3-128"]);
    if(!pos) {
      speaker.tag.attr("autoplay","autoplay");
    }
    speaker.tag.attr("controls","controls");
    speaker.tag.on("ended",this,events.songEnded);
    mainWindow.find(".status").prepend(speaker.tag);
    speaker.tag[0].play();
    speaker.tid = tid;
    if(pos) {
      speaker.tag[0].addEventListener('loadedmetadata', function() { 
        this.fastSeek(pos); 
        this.play(); 
      }, false);
    }
    save();
    this.playing = true;
    this.refresh();
  };
  
  this.pause = function() {
    this.playing = false;
    if(speaker.tag[0]) {
      speaker.tag[0].pause();
    }
  };
  
  this.getTime = function() {
    return speaker.tag[0].currentTime;
  };
  
  this.filter = function(s) {
     searchString = s;
     this.refresh(1);
  };
 
}

function initBCLibrary(noButtons) {
  // Show buttons next to tracks on an album page
  var box_style = {
    "position":"absolute",
    "color" : "black",
    "background": "none repeat scroll 0 0 #fff", 
    "border": "1px solid #d9d9d9",
    "width" : "16px",
    "height" : "16px",
    "font-weight" : "800",
    "text-align" : "center",
    "font-size" : "14px",
    "cursor" : "pointer"
    };

  var showButtonAddAlbum = function(Lib) {
    var thead = $('<thead></thead>').appendTo($("#track_table"));
    var tr = $('<tr></tr>').appendTo(thead);
    var td = $('<th colspan="3">Add whole album</th>').appendTo(tr).click(clickButtonAddTracks); 
    
    var pos = td.offset();
    $("<div>+</div>").click(Lib,clickButtonAddTracks).css(box_style).css({
      "top" : pos.top+2,
      "left" : pos.left-19
    }).appendTo(document.body);
  }
  var showButtonsAddTrack = function(Lib) {
    var boxes = [];
    $("#trackInfo .play_status").each(function(index) {
      var pos = $(this).offset();
      var box = $("<div></div>").data("trackIndex",index).css(box_style).css({
        "top" : pos.top-4,
        "left" : pos.left-19
      }).appendTo(document.body);
      box.hover(function() {
          var box = $(this);
          if(box.data("saved"))
            box.html("&cross;");
        },function() {
          var box = $(this);
          if(box.data("saved"))
            box.html("&check;");
      });
      box.click(Lib,clickButtonAddTrack);
      if(Lib.trackExists(unsafeWindow.TralbumData.trackinfo[index].id)) {
        box.html("&check;");
        box.data("saved",true);
        box.attr("class","buttonAddTrack saved");
      } else {
        box.html("+");
        box.data("saved",false);
        box.attr("class","buttonAddTrack notsaved");
      }
     boxes.push(box);
    });
    window.setInterval(function() {
      // Update position
      var play_status = $("#trackInfo .play_status");
      $("#trackInfo .play_status").each(function(index) {
        var pos = $(this).offset();
        boxes[index].css("top",pos.top);
        boxes[index].css("left",pos.left-19);
      });
    },3000);
    
  }
  var showButtonAddSingleTrack = function(Lib) {
    var pos = $("#trackInfo").offset();
    var box = $("<div></div>").css(box_style).css({
      "top" : pos.top+42,
      "left" : pos.left-19
    }).appendTo(document.body);
    box.hover(function() {
        var box = $(this);
        if(box.data("saved"))
          box.html("&cross;");
      },function() {
        var box = $(this);
        if(box.data("saved"))
          box.html("&check;");
    });
    box.click(Lib,clickButtonAddSingleTrack);
    if(Lib.trackExists(unsafeWindow.TralbumData.id)) {
      box.html("&check;");
      box.data("saved",true);
      box.attr("class","buttonAddTrack saved");
    } else {
      box.html("+");
      box.data("saved",false);
      box.attr("class","buttonAddTrack notsaved");
    }

  }
  var clickButtonAddTrack = function(ev) {
    var Lib = ev.data;
    var box = $(this);
    var trackIndex = parseInt(box.data("trackIndex"),10);
    if(box.data("saved")) {
       // remove track
      Lib.removeTrack(unsafeWindow.TralbumData.trackinfo[trackIndex].id,function(success) {
        if(success) {
          box.html("&cross;").css("color","red");
          box.data("saved",false);
          box.attr("class","buttonAddTrack notsaved");
        } else {
          box.html("&#x2754;");
        }
      });
    } else {
       // add track
      var lyrics = "";
      if($("#_lyrics_"+(trackIndex+1)).length > 0) {
        lyrics = $.trim($("#_lyrics_"+(trackIndex+1)).text());
      }
      
      Lib.addTrack(unsafeWindow.TralbumData.trackinfo[trackIndex],unsafeWindow.TralbumData,lyrics,function(success) {
        if(success) {
          box.html("&check;");
          box.data("saved",true);
          box.attr("class","buttonAddTrack saved");
        } else {
          $box.html("&#x2754;");
        }
      });
    }
  }
  var clickButtonAddTracks = function(ev) {
    var buttons = $(".buttonAddTrack.notsaved");
    if(0 === buttons.length) {
      alert("No songs left to add");
      return;
    }
    if(!confirm("Add "+buttons.length+" songs?")) {
      return;
    }
    buttons.click();
  }
  var clickButtonAddSingleTrack = function(ev) {
    var Lib = ev.data;
    var box = $(this);
    if(box.data("saved")) {
       // remove track
      Lib.removeTrack(unsafeWindow.TralbumData.id,function(success) {
        if(success) {
          box.html("&cross;").css("color","red");
          box.data("saved",false);
          box.attr("class","buttonAddTrack notsaved");
        } else {
          box.html("&#x2754;");
        }
      });
    } else {
       // add track
      var lyrics = unsafeWindow.TralbumData.current.lyrics;
      if(lyrics) {
        unsafeWindow.TralbumData.trackinfo[0].has_lyrics = true;
      }
      var albumtitle = $("#name-section span[itemprop='inAlbum'] span[itemprop='name']").text();
      unsafeWindow.TralbumData.albumtitle = albumtitle;
      var a = $("#name-section span[itemprop='inAlbum'] a[itemprop='url']");
      if(albumtitle && a.length) {
        if(!confirm(["It seems like you're on a webpage for a single track.",
        "If there is a website for the whole album, it is safer to add the track from the album page.",
        "\nAdd the track from here anyway?",
        "\nIf this is actually a single track without an album, just ignore the above message and press OK."].join("\n"))) {
          if(a.length && a[0].href && confirm("Visit album page now?\n"+a[0].href)) {
            document.location.href = a[0].href;            
          }
          return;
        }
      }
      
      Lib.addTrack(unsafeWindow.TralbumData.trackinfo[0],unsafeWindow.TralbumData,lyrics,function(success) {
        if(success) {
          box.html("&check;");
          box.data("saved",true);
          box.attr("class","buttonAddTrack saved");
        } else {
          $box.html("&#x2754;");
        }
      });
    }
  }
  
  
  var l = new BCLibrary();
  if(!noButtons && unsafeWindow.TralbumData && document.getElementById("track_table")) {
    // album page
    var tr = document.getElementById("track_table").getElementsByTagName("tr")
    if(tr.length > 1) {
      showButtonAddAlbum(l);
    }
    if(tr.length > 0) {
      showButtonsAddTrack(l);
    }
    return {"library":l,"buttons":true};
  } else if(!noButtons && unsafeWindow.TralbumData && document.getElementById("trackInfoInner")) {
    // Single track page
    showButtonAddSingleTrack(l);
    return {"library":l,"buttons":true};
  }
  
  
  
  
  
  return {"library":l,"buttons":false};
}


function BCPlayerLib_example() {
  // minimal example
  GM_addStyle("\
  #playerX {z-index: 15; position:absolute; right: 10px; top: 48px; width:400px; height: 400px;\
    border:2px solid black; background: white; font-size:smaller;}\
  #playerX ol{list-style: decimal-leading-zero inside; }\
  #playerX td,th {padding: 0.3em 0.5em}\
  #playerX .library {border:1px solid black}\
  #playerX .playlist {background:silver}");
    
  var obj = initBCLibrary();
  var pl = new BCPlayer(obj.library,"playerX");
  
  pl.getMainWindow().appendTo(document.body);
  pl.refresh();
  }