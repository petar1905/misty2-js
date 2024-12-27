# Quick start

index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="style.css">
    <title>Misty 2</title>
  </head>
  <body>
    <canvas id="camera"></canvas>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

main.js
```js
import { Misty2Robot, drawMessage} from "misty2-js";

const camera = document.getElementById("camera");
const ipAddress = prompt("What is Misty's IP address?");
const robot = new Misty2Robot(ipAddress);

robot.restart();
setTimeout(() => {
    robot.getVideoStream().then((ws) => {
        ws.onmessage = (evt) => {
            drawMessage(camera, evt);
        };
        ws.onclose = () => {
            console.log("Video stream closed.");
        };
    }).catch((error) => {
        console.error("Failed to start video stream:", error);
    });
}, 50*1000);


let currentGamepad;
window.addEventListener("gamepadconnected", (event) => {
    currentGamepad = event.gamepad;
    (function loop() {
        let gamepadList = navigator.getGamepads();
        if (gamepadList[currentGamepad.index]) {
            robot.update(gamepadList[currentGamepad.index]);
        }
        requestAnimationFrame(loop);
    })();
})
```