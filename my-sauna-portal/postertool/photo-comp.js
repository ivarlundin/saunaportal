// =================================
// PHOTO COMPONENT / CROPPER
// =================================

// Canonical output size
const CROP_WIDTH = 405;
const CROP_HEIGHT = 564;


// =================================
// CROPPER STATE
// =================================

const cropper = {

    file: null,

    image: null,

    zoom: 1,

    x: 0,

    y: 0,

    dragging: false,

    startX: 0,

    startY: 0,

    startImageX: 0,

    startImageY: 0,

    pointers: new Map(),

    pinchStartDistance: 0,

    pinchStartZoom: 1

};


// =================================
// ELEMENTS
// =================================

const cropStage =
    document.getElementById("crop-stage");

const cropImage =
    document.getElementById("crop-image");

const cropOverlay =
    document.querySelector(".crop-overlay");

const zoomInput =
    document.getElementById("crop-zoom");

const xInput =
    document.getElementById("crop-x");

const yInput =
    document.getElementById("crop-y");


// =================================
// CREATE PHOTO ELEMENT
// =================================

function createPhotoElement(file) {

    const url =
        URL.createObjectURL(file);

    const image =
        document.createElement("img");

    image.src = url;

    image.alt =
        "Participant photo";

    return image;
}


// =================================
// LOAD PHOTO
// =================================

function loadCropImage(file) {

    if (!cropImage || !cropStage) {
        return;
    }


    cropper.file = file;

    cropper.zoom = 1;

    cropper.x = 0;

    cropper.y = 0;


    if (zoomInput) {
        zoomInput.value = "1";
    }

    if (xInput) {
        xInput.value = "0";
    }

    if (yInput) {
        yInput.value = "0";
    }


    const url =
        URL.createObjectURL(file);


    cropImage.onload = () => {

        cropper.image =
            cropImage;

        updateCrop();

        cropStage.classList.add(
            "has-image"
        );

    };


    cropImage.src = url;
}


// =================================
// UPDATE CROP
// =================================

function updateCrop() {

    if (!cropImage) {
        return;
    }


    cropImage.style.transform =
        `
        translate(
            calc(-50% + ${cropper.x}px),
            calc(-50% + ${cropper.y}px)
        )
        scale(${cropper.zoom})
        `;
}


// =================================
// SLIDERS
// =================================

zoomInput?.addEventListener(
    "input",
    () => {

        cropper.zoom =
            Number(
                zoomInput.value
            );

        updateCrop();

    }
);


xInput?.addEventListener(
    "input",
    () => {

        cropper.x =
            Number(
                xInput.value
            ) * 2;

        updateCrop();

    }
);


yInput?.addEventListener(
    "input",
    () => {

        cropper.y =
            Number(
                yInput.value
            ) * 2;

        updateCrop();

    }
);


// =================================
// POINTER HELPERS
// =================================

function getPointerDistance() {

    const pointers =
        Array.from(
            cropper.pointers.values()
        );


    if (pointers.length < 2) {
        return 0;
    }


    const a = pointers[0];

    const b = pointers[1];


    const dx =
        b.x - a.x;

    const dy =
        b.y - a.y;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


// =================================
// POINTER DOWN
// =================================

cropStage?.addEventListener(
    "pointerdown",
    event => {

        if (
            !cropper.image ||
            event.target === cropOverlay
        ) {
            return;
        }


        cropStage.setPointerCapture(
            event.pointerId
        );


        cropper.pointers.set(
            event.pointerId,
            {
                x: event.clientX,
                y: event.clientY
            }
        );


        // -----------------------------
        // PINCH START
        // -----------------------------

        if (
            cropper.pointers.size === 2
        ) {

            cropper.pinchStartDistance =
                getPointerDistance();

            cropper.pinchStartZoom =
                cropper.zoom;

            cropper.dragging =
                false;

            return;
        }


        // -----------------------------
        // DRAG START
        // -----------------------------

        cropper.dragging =
            true;


        cropper.startX =
            event.clientX;

        cropper.startY =
            event.clientY;

        cropper.startImageX =
            cropper.x;

        cropper.startImageY =
            cropper.y;

    }
);


// =================================
// POINTER MOVE
// =================================

cropStage?.addEventListener(
    "pointermove",
    event => {

        if (!cropper.pointers.has(
            event.pointerId
        )) {
            return;
        }


        cropper.pointers.set(
            event.pointerId,
            {
                x: event.clientX,
                y: event.clientY
            }
        );


        // -----------------------------
        // PINCH ZOOM
        // -----------------------------

        if (
            cropper.pointers.size === 2
        ) {

            const distance =
                getPointerDistance();


            if (
                cropper.pinchStartDistance > 0
            ) {

                const scale =
                    distance /
                    cropper.pinchStartDistance;


                cropper.zoom =
                    cropper.pinchStartZoom *
                    scale;


                cropper.zoom =
                    Math.max(
                        1,
                        Math.min(
                            3,
                            cropper.zoom
                        )
                    );


                if (zoomInput) {

                    zoomInput.value =
                        cropper.zoom;

                }


                updateCrop();

            }


            return;
        }


        // -----------------------------
        // DRAG
        // -----------------------------

        if (!cropper.dragging) {
            return;
        }


        const dx =
            event.clientX -
            cropper.startX;

        const dy =
            event.clientY -
            cropper.startY;


        cropper.x =
            cropper.startImageX + dx;

        cropper.y =
            cropper.startImageY + dy;


        updateCrop();


        // Sync sliders

        if (xInput) {

            xInput.value =
                Math.max(
                    -100,
                    Math.min(
                        100,
                        cropper.x / 2
                    )
                );

        }


        if (yInput) {

            yInput.value =
                Math.max(
                    -100,
                    Math.min(
                        100,
                        cropper.y / 2
                    )
                );

        }

    }
);


// =================================
// POINTER UP
// =================================

function handlePointerEnd(event) {

    cropper.pointers.delete(
        event.pointerId
    );


    if (
        cropper.pointers.size < 2
    ) {

        cropper.pinchStartDistance =
            0;

    }


    if (
        cropper.pointers.size === 0
    ) {

        cropper.dragging =
            false;

    }

}


cropStage?.addEventListener(
    "pointerup",
    handlePointerEnd
);


cropStage?.addEventListener(
    "pointercancel",
    handlePointerEnd
);


// =================================
// CREATE CROPPED IMAGE
// =================================

async function createCroppedImage() {

    if (
        !cropper.image ||
        !cropStage
    ) {

        throw new Error(
            "Ingen bild att beskära."
        );

    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        CROP_WIDTH;

    canvas.height =
        CROP_HEIGHT;


    const ctx =
        canvas.getContext("2d");


    if (!ctx) {

        throw new Error(
            "Kunde inte skapa canvas."
        );

    }


    const image =
        cropper.image;


    // =================================
    // STAGE
    // =================================

    const stageWidth =
        cropStage.clientWidth;

    const stageHeight =
        cropStage.clientHeight;


    // =================================
    // IMAGE ASPECT RATIO
    // =================================

    const imageRatio =
        image.naturalWidth /
        image.naturalHeight;


    const stageRatio =
        stageWidth /
        stageHeight;


    let baseWidth;
    let baseHeight;


    // =================================
    // COVER
    // =================================

    if (
        imageRatio > stageRatio
    ) {

        baseHeight =
            stageHeight;

        baseWidth =
            stageHeight *
            imageRatio;

    } else {

        baseWidth =
            stageWidth;

        baseHeight =
            stageWidth /
            imageRatio;

    }


    // =================================
    // SCALE
    // =================================

    const scaledWidth =
        baseWidth *
        cropper.zoom;

    const scaledHeight =
        baseHeight *
        cropper.zoom;


    // =================================
    // POSITION
    // =================================

    const left =
        (
            stageWidth -
            scaledWidth
        ) / 2 +
        cropper.x;


    const top =
        (
            stageHeight -
            scaledHeight
        ) / 2 +
        cropper.y;


    // =================================
    // SOURCE RECTANGLE
    // =================================

    const sourceScaleX =
        image.naturalWidth /
        scaledWidth;

    const sourceScaleY =
        image.naturalHeight /
        scaledHeight;


    const sourceX =
        -left *
        sourceScaleX;

    const sourceY =
        -top *
        sourceScaleY;


    const sourceWidth =
        stageWidth *
        sourceScaleX;

    const sourceHeight =
        stageHeight *
        sourceScaleY;


    // =================================
    // DRAW
    // =================================

    ctx.drawImage(
        image,

        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,

        0,
        0,
        CROP_WIDTH,
        CROP_HEIGHT
    );


    // =================================
    // JPEG BLOB
    // =================================

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        reject(
                            new Error(
                                "Kunde inte skapa bilden."
                            )
                        );

                        return;
                    }


                    resolve(blob);

                },

                "image/jpeg",

                0.90
            );

        }
    );

}