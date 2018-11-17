// ==UserScript==
// @name         Youtube title translate reverser
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Remove auto-translated youtube titles
// @author       Pierre Couy
// @match        https://www.youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    /*
    Get a YouTube Data v3 API key from https://console.developers.google.com/apis/library/youtube.googleapis.com?q=YoutubeData
    */
    while(GM_getValue("api_key") === undefined || GM_getValue("api_key") === null || GM_getValue("api_key") === ""){
        GM_setValue("api_key", prompt("Enter your API key"));
    }
    const API_KEY = GM_getValue("api_key");


    var url_template = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id={IDs}&key=" + API_KEY;

    var alreadyChanged = [];
    var running = true;

    function changeTitles(){
        var links = Array.prototype.slice.call(document.getElementsByTagName("a")).filter( a => {
            return a.id == 'video-title' && alreadyChanged.indexOf(a) == -1;
        } );
        var spans = Array.prototype.slice.call(document.getElementsByTagName("span")).filter( a => {
            return a.id == 'video-title' && alreadyChanged.indexOf(a) == -1;
        } );
        links = links.concat(spans).slice(0,30);

        if(links.length > 0){
            console.log('Changing titles');
            var IDs = links.map( a => {
                while(a.tagName != "A"){
                    a = a.parentNode;
                }
                var href = a.href;
                var tmp = href.split('v=')[1];
                return tmp.split('&')[0];
            } );
            console.log(links);

            var requestUrl = url_template.replace("{IDs}", IDs.join(','));

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    var data = JSON.parse(xhr.responseText);
                    if(data.kind == "youtube#videoListResponse"){
                        data = data.items;
                        var titleStore = {}
                        data = data.forEach( v => {
                            titleStore[v.id] = v.snippet.title;
                        } );
                        console.log(titleStore);
                        for(var i=0 ; i < links.length ; i++){
                            if(titleStore[IDs[i]] !== undefined){
                                links[i].innerText = titleStore[IDs[i]];
                                alreadyChanged.push(links[i]);
                            }
                        }
                    }else{
                        console.log(requestUrl);
                        console.log(data);
                        if(data.error != undefined && (data.error.errors[0].domain == "usageLimits" || data.error.errors[0].reason == "keyInvalid")){
                            clearInterval(intervalID);
                            if(running){
                                running = false;
                                var tmp = prompt("Enter your API key");
                                if(tmp !== null && tmp !== "" && tmp !== undefined){
                                    GM_setValue("api_key", tmp);
                                    url_template = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id={IDs}&key=" + GM_getValue("api_key");
                                }
                                running = true;
                            }
                            intervalID = setInterval(changeTitles, 1000);
                        }
                    }
                }
            };
            xhr.open('GET', requestUrl);
            xhr.send();
        }
    }
    var intervalID = setInterval(changeTitles, 1000);

})();

