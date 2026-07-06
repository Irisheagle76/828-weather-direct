# 828 Weather Direct OBS overlay

In OBS, choose **Sources -> + -> Browser**. Use **Local File** and select `index.html`, or enter the deployed URL `https://avlweather.com/obs-overlay/`. Set the source to about **420 x 170**, then place it in a corner over the sky-camera feed.

The page is transparent, refreshes the weather every 60 seconds, and displays an unavailable message if the endpoint cannot be reached.
