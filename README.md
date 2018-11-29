# YoutubeAutotranslateCanceler


I was annoyed by YouTube changing video titles to poorly auto-translated versions, so I made this script using YouTube Data API to retrive original titles and change them back.

# How to use

First, you need a userscript extension, such as Tampermonkey for [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/). Next, click [here](https://github.com/pcouy/YoutubeAutotranslateCanceler/raw/master/AntiTranslate.user.js) to install the userscript.

Unfortunately, this requires an API key to work. However, requests to this API are free. You can browse to [Google's official support](https://developers.google.com/youtube/v3/getting-started) in order to know how to get an API key. Then, you need to enable Youtube Data API for this key in [Google Developers Console](https://console.developers.google.com/apis/api/youtube.googleapis.com/) and you're good to go.

When you first run the script, it prompts you for an API key until it manages to complete a successful request.
