// =================================
// PHOTO FORM
// =================================

const photoForm =
    document.getElementById("participant-form");

const photoInput =
    document.getElementById("photo");

const nameInput =
    document.getElementById("name");

const statusElement =
    document.getElementById("status");

const photoStep =
    document.getElementById("photo-step");

const cropStep =
    document.getElementById("crop-step");

const detailsStep =
    document.getElementById("details-step");

const cropperElement =
    document.getElementById("photo-cropper");

const cropBackButton =
    document.getElementById("crop-back");

const cropNextButton =
    document.getElementById("crop-next");

const detailsBackButton =
    document.getElementById("details-back");

const stepIndicator =
    document.getElementById("mobile-step-indicator");

const finalPhoto =
    document.getElementById("final-photo");


// =================================
// STEP NAVIGATION
// =================================

function showMobileStep(step) {

    document
        .querySelectorAll(".mobile-step")
        .forEach(element => {

            element.classList.remove(
                "active"
            );

        });


    if (step === 1) {

        photoStep?.classList.add(
            "active"
        );

    }


    if (step === 2) {

        cropStep?.classList.add(
            "active"
        );

    }


    if (step === 3) {

        detailsStep?.classList.add(
            "active"
        );

    }


    if (stepIndicator) {

        stepIndicator.textContent =
            `Steg ${step} av 3`;

    }

}


// =================================
// PHOTO SELECTED
// =================================

photoInput?.addEventListener(
    "change",
    () => {

        const file =
            photoInput.files[0];


        if (!file) {
            return;
        }


        loadCropImage(file);


        if (cropperElement) {

            cropperElement.style.display =
                "block";

        }


        showMobileStep(2);

    }
);


// =================================
// CROP → DETAILS
// =================================

cropNextButton?.addEventListener(
    "click",
    async () => {

        try {

            cropNextButton.disabled =
                true;

            cropNextButton.textContent =
                "Förbereder...";


            const blob =
                await createCroppedImage();


            if (!blob) {

                throw new Error(
                    "Kunde inte beskära bilden."
                );

            }


            // Preview cropped image

            const url =
                URL.createObjectURL(blob);


            if (finalPhoto) {

                finalPhoto.src =
                    url;

            }


            // Store temporary crop

            window.croppedPhotoBlob =
                blob;


            showMobileStep(3);

        } catch (error) {

            console.error(error);

            setStatus(
                `Fel: ${error.message}`
            );

        } finally {

            cropNextButton.disabled =
                false;

            cropNextButton.textContent =
                "Nästa →";

        }

    }
);


// =================================
// CROP BACK
// =================================

cropBackButton?.addEventListener(
    "click",
    () => {

        showMobileStep(1);

    }
);


// =================================
// DETAILS BACK
// =================================

detailsBackButton?.addEventListener(
    "click",
    () => {

        showMobileStep(2);

    }
);


// =================================
// FORM SUBMIT
// =================================

photoForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const name =
            nameInput.value.trim();


        if (!window.croppedPhotoBlob) {

            setStatus(
                "Ta och beskära en bild först."
            );

            return;
        }


        if (!name) {

            setStatus(
                "Skriv ett namn."
            );

            nameInput.focus();

            return;
        }


        try {

            setStatus(
                "Laddar upp..."
            );


            // =================================
            // FILE NAME
            // =================================

            const fileName =
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}.jpg`;


            // =================================
            // UPLOAD
            // =================================

            const {
                error: uploadError
            } = await supabaseClient
                .storage
                .from("poster_photos")
                .upload(
                    fileName,
                    window.croppedPhotoBlob,
                    {
                        contentType:
                            "image/jpeg",

                        upsert:
                            false
                    }
                );


            if (uploadError) {

                throw uploadError;

            }


            // =================================
            // DATABASE
            // =================================

            const {
                error: databaseError
            } = await supabaseClient
                .from("participants")
                .insert({

                    name:
                        name,

                    photo_path:
                        fileName

                });


            if (databaseError) {

                throw databaseError;

            }


            // =================================
            // SUCCESS
            // =================================

            setStatus(
                `${name} sparad!`
            );


            // Reset

            photoForm.reset();

            nameInput.value = "";

            window.croppedPhotoBlob =
                null;


            if (finalPhoto) {
                finalPhoto.src = "";
            }


            if (cropperElement) {

                cropperElement.style.display =
                    "none";

            }


            showMobileStep(1);


        } catch (error) {

            console.error(
                "Upload error:",
                error
            );


            setStatus(
                `Fel: ${error.message}`
            );

        }

    }
);


// =================================
// STATUS
// =================================

function setStatus(message) {

    if (!statusElement) {
        return;
    }


    statusElement.textContent =
        message;

}