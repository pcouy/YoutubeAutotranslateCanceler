// ==UserScript==
// @name         Youtube Auto-translate Canceler
// @namespace    https://github.com/pcouy/YoutubeAutotranslateCanceler/
// @version      0.2
// @description  Remove auto-translated youtube titles
// @author       Pierre Couy
// @modified-by  -FTOH-
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// @noframes
// @require      http://xregexp.com/v/3.2.0/xregexp-all.js
// ==/UserScript==



(function(){

    /* Run group of code */
    function $(group, collapsed, block){
        collapsed ? console.groupCollapsed(group) : console.group(group)
        try { block() } catch(e) { console.error(e) }
        console.groupEnd(group)
    }

    /* Compare without links */
    function compare(left, right) {
        left = left.replace(/https?:\/\/\S+/gi, '')
        right = right.replace(/https?:\/\/\S+/gi, '')
        return left === right
    }

    const css = 'background: #222; color: white'; // style for title in console

    window.addEventListener("yt-navigate-finish", () => {
        $('[YoutubeAutotranslateCanceler]', false, () => {
            console.log('Event fired')
            
            var vedeoData = window['page-manager'].__data__.data

            if(!vedeoData.playerResponse) {
                console.log('Video data is empty. Script finished!')
                return;
            }

            var original = vedeoData.playerResponse.videoDetails

            var current = vedeoData.response.contents.twoColumnWatchNextResults.results.results.contents
            var prim = current[0].videoPrimaryInfoRenderer
            var secn = current[1].videoSecondaryInfoRenderer

            if(prim.title.simpleText === original.title) {
                console.log('Title %c %s %c not be replaced', css, original.title, '',)
            } else {
                console.log('Title %c %s %c replaced with %c %s ', css, prim.title.simpleText, '', css, original.title)
                prim.title.simpleText = original.title
            }

            var plainDescription = secn.description.runs.map(i => i.text).join('')

            if(compare(plainDescription, original.shortDescription) === false) {
                $('Locale-based description', true, () => {
                    console.log(plainDescription)
                })
                secn.description = {
                    runs: convert(original.shortDescription, original.videoId)
                }
            }

            $('Original description', true, () => {
                console.log(original.shortDescription)
            })


        })
    });

    function isDigit(char){
        var code = char.charCodeAt(0)
        return 48 <= code && code <= 57
    }

    function convert(text, videoId){
        var runs = [], lastPos = 0, pos = 0
        function cutPrevString() {
            if(lastPos < pos) {
                runs.push({ text: text.substring(lastPos, pos) })
            }
        }

        for (pos = 0; pos < text.length; pos++) {
            var match = false

            // Hyperlinks
            if(text[pos].toLowerCase() === 'h' && (match = text.substr(pos).match(/^https?:\/\/\S+/i))) {
                cutPrevString()
                runs.push({
                    text: match[0].length > 40 ? match[0].substr(0, 37) + '...' : match[0],
                    navigationEndpoint: {
                        urlEndpoint: {
                            nofollow: true,
                            target: 'TARGET_NEW_WINDOW',
                            url: match[0]
                        }
                    }
                })
                // Hashtags
            } else if(text[pos] === '#' && (match = window.XRegExp('^#\\pL(\\pL|\\d)*').exec(text.substr(pos)))) {
                cutPrevString()
                runs.push({
                    text: match[0],
                    navigationEndpoint: {
                        searchEndpoint: {
                            query: match[0]
                        }
                    }
                })
                // Timecode
            } else if(isDigit(text[pos]) && (match = text.substr(pos).match(/^(\d?\d:)?\d?\d:\d\d/))) {
                cutPrevString()
                var seconds = match[0].split(':').map(i => parseInt(i)).reduce((sum, i) => sum * 60 + i)
                runs.push({
                    text: match[0],
                    navigationEndpoint: {
                        watchEndpoint: {
                            continuePlayback: true,
                            startTimeSeconds: seconds,
                            videoId: videoId
                        }
                    }
                })
            } else if(pos === text.lenght - 1) {
                cutPrevString()
            }

            if(match) {
                lastPos = pos += match[0].length
            }
        }

        return runs
    }

})();
