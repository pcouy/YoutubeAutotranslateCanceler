// ==UserScript==
// @name         Youtube title fixer
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
    var NO_API_KEY = false;
    if(GM_getValue("api_key") === undefined || GM_getValue("api_key") === null || GM_getValue("api_key") === ""){
        GM_setValue("api_key", prompt("Enter your API key. Go to https://developers.google.com/youtube/v3/getting-started to know how to obtain an API key, then go to https://console.developers.google.com/apis/api/youtube.googleapis.com/ in order to enable Youtube Data API for your key."));
    }
    if(GM_getValue("api_key") === undefined || GM_getValue("api_key") === null || GM_getValue("api_key") === ""){
    	NO_API_KEY = true; // Resets after page reload, still allows local title to be replaced
    }
    const API_KEY = GM_getValue("api_key");
    var API_KEY_VALID = false;


    var url_template = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id={IDs}&key=" + API_KEY;

    var changedTitle;
    var changedDescription
    var alreadyChanged = [];

    function changeTitles(){

        // MAIN TITLE
        if (!changedTitle && window.location.href.includes ("/watch")){
            var videoTitle = document.title.endsWith(" - YouTube")? document.title.substring(0, document.title.length - " - YouTube".length) : null;
            var pageTitle = document.getElementsByClassName("title style-scope ytd-video-primary-info-renderer");
            if (pageTitle.length > 0 && videoTitle != null && pageTitle[0] !== undefined) {
                if (pageTitle[0].innerText != videoTitle){
                    console.log ("Reverting main video title '" + pageTitle[0].innerText + "' to '" + videoTitle + "'");
                    pageTitle[0].innerText = videoTitle;
                }
                changedTitle = true;
            }
        }

        if (NO_API_KEY) {
            return;
        }

        var APIcallIDs;

        // REFERENCED VIDEO TITLES
        var links = Array.prototype.slice.call(document.getElementsByTagName("a")).filter( a => {
            return a.id == 'video-title' && alreadyChanged.indexOf(a) == -1;
        } );
        var spans = Array.prototype.slice.call(document.getElementsByTagName("span")).filter( a => {
            return a.id == 'video-title' && alreadyChanged.indexOf(a) == -1;
        } );
        links = links.concat(spans).slice(0,30);

         // MAIN VIDEO DESCRIPTION
        var mainVidID = "";
        if (!changedDescription && window.location.href.includes ("/watch")){
            mainVidID = window.location.href.split('v=')[1].split('&')[0];
        }

        if(mainVidID != "" || links.length > 0){

            console.log("Checking " + (mainVidID != ""? "main video and " : "") + links.length + " video titles!");
            //console.log(links.map(a => a.innerText));

            var IDs = links.map( a => {
                while(a.tagName != "A"){
                    a = a.parentNode;
                }
                var href = a.href;
                var tmp = href.split('v=')[1];
                return tmp.split('&')[0];
            } );
            var requestUrl = url_template.replace("{IDs}", (mainVidID != ""? (mainVidID + ",") : "") + IDs.join(','));

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    var data = JSON.parse(xhr.responseText);

                    if(data.kind == "youtube#videoListResponse"){
                        API_KEY_VALID = true;

                        data = data.items;

                        if (mainVidID != "")
                        { // Replace Main Video Description
                            var videoDescription = data[0].snippet.description;
                            var pageDescription = document.getElementsByClassName("content style-scope ytd-video-secondary-info-renderer");
                            if (pageDescription.length > 0 && videoDescription != null && pageDescription[0] !== undefined) {
                                // TODO: linkify replaces links correctly for now, but without redirect or other specific youtube stuff.
                                // Works, but need to verify it works since this replaces ALL descriptions, even if it was not translated in the first place (no easy comparision possible)
                                pageDescription[0].innerHTML = linkify(videoDescription);
                                console.log ("Reverting main video description!");
                                changedDescription = true;
                            }
                            else console.log ("Failed to find main video description!");
                        }

                        var titleStore = {}
                        data = data.forEach( v => {
                            titleStore[v.id] = v.snippet.title;
                        } );
                        //console.log("Original Titles (API):");
                        //console.log(titleStore);

                        for(var i=0 ; i < links.length ; i++){
                            var originalTitle = titleStore[IDs[i]];
                            if(titleStore[IDs[i]] !== undefined && links[i].innerText != originalTitle.replace(/\s{2,}/g, ' ')){
                                console.log ("'" + links[i].innerText + "' --> '" + originalTitle + "'");
                                links[i].innerText = originalTitle;
                            }
                            alreadyChanged.push(links[i]);
                        }
                    } else {
                        console.log("API Request Failed!");
                        console.log(requestUrl);
                        console.log(data);
                        // This ensures that occasional fails don't stall the script
                        // But if the first query is a fail then it won't try repeatedly
                        NO_API_KEY = !API_KEY_VALID;
                        if (NO_API_KEY) {
                            console.log("API Key Fail! Please Reload!");
                        }
                    }
                }
            };
            xhr.open('GET', requestUrl);
            xhr.send();

        }
    }

    function linkify(inputText) {
        var replacedText, replacePattern1, replacePattern2, replacePattern3;

        //URLs starting with http://, https://, or ftp://
        replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
        replacedText = inputText.replace(replacePattern1, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="$1">$1</a>');


        //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
        replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        replacedText = replacedText.replace(replacePattern2, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="http://$1">$1</a>');

        //Change email addresses to mailto:: links.
        replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
        replacedText = replacedText.replace(replacePattern3, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="mailto:$1">$1</a>');

        return replacedText;
    }

    function setupDOMListener (callback) {
        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
        if( MutationObserver ){
            var obs = new MutationObserver(callback);
            obs.observe(document.body, { childList:true, subtree:true });
        }
        else if( window.addEventListener ){
            document.body.addEventListener('DOMNodeInserted', callback, false);
            document.body.addEventListener('DOMNodeRemoved', callback, false);
        }
    }



    // Execute manually during usual load time
    changeTitles ();
    setTimeout(changeTitles, 500);
    setTimeout(changeTitles, 1000);
    setTimeout(changeTitles, 2000);


    // Setup DOM listener for the rest of the lifetime
    // But so that very fast consecutive DOM changes (50ms margin) are grouped together
    // And an API request is only issued once for all of them
    var DOM_CHANGED = false;
    var DOM_CHANGE_TIMER_ID;
    setTimeout(() => {
        setupDOMListener (() => {
            DOM_CHANGED = true;
            clearTimeout(DOM_CHANGE_TIMER_ID);
            DOM_CHANGE_TIMER_ID = setTimeout (() => {
                if (DOM_CHANGED){
                    DOM_CHANGED = false;
                    changeTitles ();
                }
            }, 50);
        });
    }, 2000);



})();

