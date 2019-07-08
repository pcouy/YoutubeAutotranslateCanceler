// ==UserScript==
// @name         Youtube Auto-translate Canceler
// @namespace    https://github.com/pcouy/YoutubeAutotranslateCanceler/
// @version      0.2
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

    var cachedTitles = {} // Dictionary(id, title): Cache of API fetches, survives only Youtube Autoplay

    var currentLocation; // String: Current page URL
    var changedDescription; // Bool: Changed description
    var alreadyChanged; // List(string): Links already changed

    function getVideoID(a)
    {
        while(a.tagName != "A"){
            a = a.parentNode;
        }
        return a.href.match (/(?:v=)([a-zA-Z0-9-_]+)/)[1];
    }

    function resetChanged(){
        console.log(" --- Page Change detected! --- ");
        currentLocation = document.title;
        changedDescription = false;
        alreadyChanged = [];
    }
    resetChanged();

    function changeTitles(){
        if(currentLocation !== document.title) resetChanged();

        // MAIN TITLE - no API key required
        if (window.location.href.includes ("/watch")){
            var titleMatch = document.title.match (/^(?:\([0-9]+\) )?(.*?)(?: - YouTube)$/); // ("(n) ") + "TITLE - YouTube"
            var pageTitle = document.getElementsByClassName("title style-scope ytd-video-primary-info-renderer");
            if (pageTitle.length > 0 && pageTitle[0] !== undefined && titleMatch != null) {
                if (pageTitle[0].innerText != titleMatch[1]){
                    console.log ("Reverting main video title '" + pageTitle[0].innerText + "' to '" + titleMatch[1] + "'");
                    pageTitle[0].innerText = titleMatch[1];
                }
            }
        }

        if (NO_API_KEY) {
            return;
        }

        var APIcallIDs;

        // REFERENCED VIDEO TITLES - find video link elements in the page that have not yet been changed
        var videoIDElements = Array.prototype.slice.call(document.querySelectorAll("#video-title")).filter(el => {
            return el.className.includes("-video-") && alreadyChanged.indexOf(el) == -1;
        } );


        // Exclude list: Radio and Playlist Normal/Grid/Compact
        // -- Radio/Mix Normal/Grid/Compact: ytd-radio-renderer -- ytd-grid-radio-renderer -- ytd-compact-radio-renderer
        // -- Playlist Normal/Grid/Compact: ytd-playlist-renderer -- ytd-compact-playlist-renderer -- ytd-grid-playlist-renderer
        // Include:
        // -- ytd-video-primary-info-renderer (Main) -- ytd-compact-video-renderer (Side) -- ytd-grid-video-renderer (Home/Channel)
        // -- Playlist Video in Playlist: ytd-playlist-video-renderer
        // -- Playlist Video while watch: ytd-playlist-panel-video-renderer
        // >> Includes -video- only condition

         // MAIN VIDEO DESCRIPTION - request to load original video description
        var mainVidID = "";
        if (!changedDescription && window.location.href.includes ("/watch")){
            mainVidID = window.location.href.match (/(?:v=)([a-zA-Z0-9-_]+)/)[1];
        }

        if(mainVidID != "" || videoIDElements.length > 0)
        { // Initiate API request

            // Get all videoIDs to put in the API request
            var IDs = videoIDElements.map( a => getVideoID (a));
            var APIFetchIDs = IDs.filter(id => cachedTitles[id] === undefined).slice(0, 50);
            var requestUrl = url_template.replace("{IDs}", (mainVidID != ""? (mainVidID + ",") : "") + APIFetchIDs.join(','));

            console.log("Checking " + (mainVidID != ""? "main video and " : "") + APIFetchIDs.length + " video titles!");

            // Issue API request
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function ()
            {
                if (xhr.readyState === 4)
                { // Success
                    var data = JSON.parse(xhr.responseText);

                    if(data.kind == "youtube#videoListResponse")
                    {
                        API_KEY_VALID = true;

                        data = data.items;

                        if (mainVidID != "")
                        { // Replace Main Video Description
                            var videoDescription = data[0].snippet.description;
                            var pageDescription = document.getElementsByClassName("content style-scope ytd-video-secondary-info-renderer");
                            if (pageDescription.length > 0 && videoDescription != null && pageDescription[0] !== undefined) {
                                // linkify replaces links correctly, but without redirect or other specific youtube stuff (no problem if missing)
                                // Still critical, since it replaces ALL descriptions, even if it was not translated in the first place (no easy comparision possible)
                                pageDescription[0].innerHTML = linkify(videoDescription);
                                console.log ("Reverting main video description!");
                                changedDescription = true;
                            }
                            else console.log ("Failed to find main video description!");
                        }

                        // Create dictionary for all IDs and their original titles
                        data = data.forEach( v => {
                            cachedTitles[v.id] = v.snippet.title;
                        } );

                        // Change all previously found link elements
                        for(var i=0 ; i < videoIDElements.length ; i++){
                            var vidElement = videoIDElements[i];
                            var curID = getVideoID(vidElement);
                            if (curID !== IDs[i]) { // Can happen when Youtube was still loading when script was invoked
                                console.log ("YouTube was too slow again...");
                                changedDescription = false; // Might not have been loaded aswell - fixes rare errors
                            }
                            if (cachedTitles[curID] !== undefined)
                            {
                                var originalTitle = cachedTitles[curID];
                                var pageTitle = vidElement.innerText.trim();
                                if(pageTitle != originalTitle.replace(/\s{2,}/g, ' '))
                                {
                                    console.log ("'" + pageTitle + "' --> '" + originalTitle + "'");
                                    vidElement.innerText = originalTitle;
                                }
                                alreadyChanged.push(vidElement);
                            }
                            else if (APIFetchIDs.includes(curID))
                            { // Has been requested, but not been provided info about: Private or deleted video
                                cachedTitles[curID] = vidElement.innerText.trim();
                                alreadyChanged.push(vidElement);
                                console.log ("Video with ID '" + curID + "' is either private or deleted!");
                            }
                        }
                    }
                    else
                    {
                        console.log("API Request Failed!");
                        console.log(requestUrl);
                        console.log(data);

                        // This ensures that occasional fails don't stall the script
                        // But if the first query is a fail then it won't try repeatedly
                        NO_API_KEY = !API_KEY_VALID;
                        if (NO_API_KEY) {
                            GM_setValue('api_key', '');
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
        var replacedText, replacePattern1, replacePattern2, replacePattern3, replacePattern4;

        //URLs starting with http://, https://, or ftp://
        replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
        replacedText = inputText.replace(replacePattern1, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="$1">$1</a>');


        //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
        replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        replacedText = replacedText.replace(replacePattern2, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="http://$1">$1</a>');

        //Change email addresses to mailto:: links.
        replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
        replacedText = replacedText.replace(replacePattern3, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="mailto:$1">$1</a>');

        //Change timestamps to clickable timestamp links.
        // NOTE: NOT perfect, even with correct html code it will cause the page to reload whereas standard youtube timestamps will not. Probably some behind-the-scenes magic.
        replacePattern4 = /([0-9]+:)?([0-9]+):([0-9]+)/gim;
        replacedText = replacedText.replace(replacePattern4, function(match) {

            // Prepare time by calculating total seconds
            var timeChars = match.split(':'); // Split by hour:minute:seconds
            var time = parseInt(timeChars[0], 10) * 60 + parseInt(timeChars[1], 10); // Only minutes:seconds
            if (timeChars.length >= 3)
            { // Full hours:minutes:seconds
                time = time * 60 + parseInt(timeChars[2], 10);
            }

            // Prepare URL
            var url = window.location.href; // Get current video URL
            url = url.slice (url.indexOf("/watch?"), url.length); // Make it local
            url = url.replace(/[?&]t=([0-9]+)s/, ""); // Remove existing timestamp
            url = url + "&t=" + time + "s";

            return '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="' + url + '">' + match + '</a>';
        });

        return replacedText;
    }

    // Execute every seconds in case new content has been added to the page
    // DOM listener would be good if it was not for the fact that Youtube changes its DOM frequently
    setInterval(changeTitles, 1000);
})();

