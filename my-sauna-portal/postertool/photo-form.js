// =================================
// PHOTO FORM
// =================================

const photoForm =
    document.getElementById("participant-form");

const photoInput =
    document.getElementById("photo");

const photoUploadInput =
    document.getElementById("photo-upload");

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

function handlePhotoSelected(file) {

    if (!file) {
        return;
    }


    console.log(
        "Photo selected:",
        file
    );


    loadCropImage(file);


    if (cropperElement) {

        cropperElement.style.display =
            "block";

    }


    showMobileStep(2);

}


// =================================
// CAMERA
// =================================

photoInput?.addEventListener(
    "change",
    () => {

        handlePhotoSelected(
            photoInput.files[0]
        );

    }
);


// =================================
// UPLOAD FROM DEVICE
// =================================

photoUploadInput?.addEventListener(
    "change",
    () => {

        handlePhotoSelected(
            photoUploadInput.files[0]
        );

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


            // =================================
            // FINAL PREVIEW
            // =================================

            const url =
                URL.createObjectURL(blob);


            if (finalPhoto) {

                finalPhoto.src =
                    url;

            }


            // =================================
            // STORE TEMPORARY CROP
            // =================================

            window.croppedPhotoBlob =
                blob;


            showMobileStep(3);

        } catch (error) {

            console.error(
                "Crop error:",
                error
            );


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


        // =================================
        // VALIDATION
        // =================================

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
            // UPLOAD PHOTO
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
            // SAVE PARTICIPANT
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


            // =================================
            // RESET
            // =================================

            photoForm.reset();

            if (photoUploadInput) {
                photoUploadInput.value = "";
            }

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