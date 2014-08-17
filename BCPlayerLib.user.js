// ==UserScript==
// @name        BCPlayerLib
// @namespace   cuzi
// @oujs:author cuzi
// @description Play bandcamp music.
// @icon        data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwAQMAAABtzGvEAAAABlBMVEUAAAAclZU8CPpPAAAAAXRSTlMAQObYZgAAAFZJREFUeF6N0DEKAzEMBMBAinxbT/NT9gkuVRg7kCFwqS7bTCVW0uOPPOvDK2hsnELQ2DiFoLFxCkFj4xSC+UMwYGBhYkDRwsRAXfdsBHW9r5HvJ27yBmrWa3qFBFkKAAAAAElFTkSuQmCC
// @version     1
// @license     GNUGPL
// @include     /^https?:\/\/.*bandcamp\..*$/
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.7/jquery.min.js
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_addStyle
// @grant       unsafeWindow
// ==/UserScript==
"use strict";

function BCLibrary() {

  var allTracks;
  var allAlbums;
  var allBands;
    
  var load = function() {
    allTracks = JSON.parse(GM_getValue("tracks","{}"));
    allAlbums = JSON.parse(GM_getValue("albums","{}"));
    allBands = JSON.parse(GM_getValue("bands","{}"));
  };
    
  var save = function() {
    GM_setValue("tracks",JSON.stringify(allTracks));
    GM_setValue("albums",JSON.stringify(allAlbums));
    GM_setValue("bands",JSON.stringify(allBands));
  };
  
  load();
  
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
    var keys = ['id','album_id','artFullsizeUrl','artThumbURL','current.about','current.credits','current.release_date','current.title','url'];
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
    
    // Album exists?
    if(!allAlbums[albumobj.id]) {
      addAlbum(albumobj);
    }
    
    // Add the track
    allAlbums[albumobj.id].tracks.push(trackobj.id);
    
    trackobj.band_id = albumobj.current.band_id;
    trackobj.album_id = albumobj.id;

    
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

    save();
    cb(true);
  };
  
  this.removeTrack = function(id,cb) {
    load();
    if(!this.trackExists(id)) {
      cb(true);
    }
    
    // Will the album be empty?
    if(1 === allAlbums[allTracks[id].album_id].tracks.length)  {
      // Yes - But will the band also have no albums?
      if(1 === allBands[allTracks[id].band_id].albums.length) {
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
    var trk = allTracks[tid];
    var alb = allAlbums[trk.album_id];
    var bnd = allBands[trk.band_id];
    return {
      "id" : tid,
      "duration" : trk.duration,
      "file" : trk.file,
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
        "release_data" : alb.release_date,
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
      self.filter(this.value);
    }
  
  };
    
  this.toString = function() {
    return "[Object Player: #"+id+"]";
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
      searchfield.on("keyup",this,events.search);
      mainWindow.find(".status").append(searchfield);
    }
    return mainWindow;
  };
  this.refresh = function(what) {
    // what:
    // 0/false/null/undefined -> refresh all
    // 1 -> only library
    // 2 -> only playlist
    
    // Library
    if(!what || 1 === what) {
      var scrollPosition = mainWindow.find(".library").scrollTop();  // Save scrollbar positon
    
      var tracks = Lib.getAllTracks();
      mainWindow.find(".library tbody").html("");
      var s = false;
      if(searchString) s = searchString.toLowerCase();
      for(var i = 0; i < tracks.length && i < 1000; i++) {
        if(s 
          && -1 == tracks[i].title.toLowerCase().indexOf(s) 
          && -1 == tracks[i].band.title.toLowerCase().indexOf(s) 
          && -1 == tracks[i].album.title.toLowerCase().indexOf(s)) {
          continue;
        }
      
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
      
      mainWindow.find(".library").scrollTop(scrollPosition);  // Restore scrollbar positon
    
    }
    // Playlist
    if(!what || 2 === what) {
      mainWindow.find(".playlistol").html("");
      for(var i = 0; i < playlist.length; i++) {
        var tid = playlist[i];
        var track = Lib.getTrackById(tid);
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
      if(this.playing) {
        var pl =  mainWindow.find(".playlist");
        var li = pl.find("li").eq(playlist_index);

        var top = parseInt(li.position().top,10);
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
  
  
  
  this.addToPlaylist = function(tid,index) {
    load();
    if(-1 == index) { // Add to end of list
      playlist.push(tid);
    } else {
      playlist.splice(index, 0, tid);
    }
    save();    
    this.refresh(2);
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
      return;
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
    
    // Stop native bandcamp player
    if(unsafeWindow.Cookie && unsafeWindow.Cookie.CommChannel) {
      var _comm = new unsafeWindow.Cookie.CommChannel("playlist");
      _comm.send("stop");
      _comm = null;
    }
    
    var tid = playlist[playlist_index];
    var track = Lib.getTrackById(tid);
    
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
    speaker.tag[0].pause();
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
  $("#trackInfo .play_status").each(function(index) {
    var pos = $(this).offset();
    var box = $("<div></div>").data("trackIndex",index).css(box_style).css({
      "top" : pos.top+20,
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
  });
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


  var l = new BCLibrary();
  if(!noButtons && unsafeWindow.TralbumData && document.getElementById("track_table")) {
    showButtonsAddTrack(l);
    showButtonAddAlbum(l);
    return {"library":l,"buttons":true};
  }
  return {"library":l,"buttons":true};
}

function BCPlayerLib_example() {
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