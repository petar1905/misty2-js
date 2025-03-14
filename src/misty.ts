/**
 * Represents a Misty2 robot and provides methods to control its movements and retrieve its video stream.
 */
export class Misty2Robot {
    private ipAddress: string;
    private headRotation: number[];
    private framesToMoveHead: number;
    private framesToMoveBody: number;
    private sensitivity: number;
    private deadzone: number;
    private imageWidth: number;
    private imageHeight: number;
    private videoQuality: number;
    private ws: WebSocket | undefined;

    /**
     * Creates an instance of Misty2Robot.
     * @param ipAddress The IP address of the Misty2 robot.
     */
    constructor(
        ipAddress: string, 
        videoQuality: number = 100, 
        imageWidth: number = 400, 
        imageHeight: number = 540
    ) {
        this.ipAddress = ipAddress;
        this.headRotation = [0, 0];
        this.framesToMoveHead = 0;
        this.framesToMoveBody = 0;
        this.sensitivity = 0.02;
        this.deadzone = 0.1;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
        this.videoQuality = videoQuality;
        this.ws = undefined;
    }

    /**
     * Starts the video stream from the robot.
     * @returns A WebSocket connection for the video stream.
     * @throws If the video stream cannot be started.
     */
    public async getVideoStream(): Promise<WebSocket> {
        const response = await fetch(`http://${this.ipAddress}/api/videostreaming/start`, {
            method: "POST",
            body: JSON.stringify({
                "Port": 5678,
                "Rotation": 90,
                "Width": this.imageWidth,
                "Height": this.imageHeight,
                "Quality": this.videoQuality
            })
        });

        if (response.status === 200) {
            this.ws = new WebSocket(`ws://${this.ipAddress}:5678`);
            this.ws.onclose = (evt) => {
                fetch(`http://${this.ipAddress}/api/videostreaming/stop`, {
                    method: "POST"
                });
                console.log("Closed socket");
            };
            return this.ws as WebSocket;
        } else {
            throw new Error("Failed to start video stream.");
        }
    }

    /**
     * Moves the robot's head based on pitch and yaw values.
     * @param pitch The pitch value to move the head.
     * @param yaw The yaw value to move the head.
     */
    private moveHead(pitch: number, yaw: number): void {
        if (++this.framesToMoveHead == 180) {
            fetch(`http://${this.ipAddress}/api/head`, {
                method: "POST",
                body: JSON.stringify({
                    "Pitch": pitch,
                    "Yaw": yaw,
                    "Velocity": 100
                })
            });
            this.framesToMoveHead = 0;
        }
    }

    /**
     * Moves the robot's body based on linear and angular velocities.
     * @param linearVelocity The linear velocity to move the body.
     * @param angularVelocity The angular velocity to move the body.
     */
    private move(linearVelocity: number, angularVelocity: number): void {
        if (++this.framesToMoveBody == 180) {
            fetch(`http://${this.ipAddress}/api/drive`, {
                method: "POST",
                body: JSON.stringify({
                    "LinearVelocity": linearVelocity,
                    "AngularVelocity": angularVelocity,
                })
            });
            this.framesToMoveBody = 0;
        }
    }

    /**
     * Restarts the robot, rebooting its system while keeping sensory services active.
     * @returns A promise that resolves when the restart is completed.
     */
    public async restart(): Promise<void> {
        const response = await fetch(`http://${this.ipAddress}/api/reboot`, {
            method: "POST",
            body: JSON.stringify({
                "Core": false,
                "SensoryServices": true
            })
        });
    }

    /**
     * Updates the robot's head and body movements based on the gamepad input.
     * @param gamepad The gamepad object containing the analog stick values.
     */
    public update(gamepad: any): void {
        const stickValues = this.readAnalogSticks(gamepad, this.deadzone);
        const headValues = this.mapAnalogValues(stickValues[2], stickValues[3]);
        this.headRotation[0] += headValues[0] * this.sensitivity;
        this.headRotation[0] = this.clamp(this.headRotation[0], -100, 100);
        this.headRotation[1] += headValues[1] * this.sensitivity;
        this.headRotation[1] = this.clamp(this.headRotation[1], -100, 100);
        const driveValues = this.mapAnalogValues(stickValues[0], stickValues[1]);
        this.moveHead(Math.trunc(this.headRotation[1]), -Math.trunc(this.headRotation[0]));
        this.move(driveValues[1], driveValues[0]);
    }

    /**
     * Reads the values from the analog sticks of the gamepad, applying deadzone filtering.
     * @param gamepad The gamepad object containing analog stick values.
     * @param deadzone The deadzone threshold to filter small movements.
     * @returns An array of four values representing the analog sticks' positions.
     */
    private readAnalogSticks(gamepad: any, deadzone: number): number[] {
        let leftStickX = gamepad.axes[0];
        if (leftStickX < deadzone && leftStickX > -deadzone) leftStickX = 0;
        let leftStickY = gamepad.axes[1];
        if (leftStickY < deadzone && leftStickY > -deadzone) leftStickY = 0;
        let rightStickX = gamepad.axes[2];
        if (rightStickX < deadzone && rightStickX > -deadzone) rightStickX = 0;
        let rightStickY = gamepad.axes[3];
        if (rightStickY < deadzone && rightStickY > -deadzone) rightStickY = 0;
        return [leftStickX, leftStickY, rightStickX, rightStickY];
    }

    /**
     * Maps the analog stick values to a scaled range for the robot's movements.
     * @param x The x-axis value of the analog stick.
     * @param y The y-axis value of the analog stick.
     * @returns An array containing the scaled x and y values.
     */
    private mapAnalogValues(x: number, y: number): number[] {
        const minX = -1;
        const maxX = 1;
        const minY = -100;
        const maxY = 100;
        const scaledX = Math.floor((x - minX) / (maxX - minX) * (maxY - minY) + minY);
        const scaledY = Math.floor((y - minX) / (maxX - minX) * (maxY - minY) + minY);
        return [scaledX, scaledY];
    }

    /**
     * Clamps a value between a specified minimum and maximum.
     * @param value The value to be clamped.
     * @param min The minimum bound.
     * @param max The maximum bound.
     * @returns The clamped value.
     */
    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max));
    }
}

/**
 * Draws a message on the canvas, which is an image blob received from a WebSocket event.
 * @param canvas The HTML canvas element where the message will be drawn.
 * @param evt The message event containing the image data.
 */
export function drawMessage(canvas: HTMLCanvasElement, evt: MessageEvent): void {
    let blob = new Blob([evt.data], { type: "image/jpeg" });
    const context2D = canvas.getContext('2d') as CanvasRenderingContext2D;
    createImageBitmap(blob, 0, 0, canvas.width, canvas.height).then((img) => {
        context2D.clearRect(0, 0, canvas.width, canvas.height);
        context2D.drawImage(img, 0, 0, canvas.width, canvas.height);
    });
}
