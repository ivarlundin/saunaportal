// ==========================================
// SAUNA FESTIVAL 2026 — SIGNUP
// ==========================================

console.log("📸 signup.js loaded");


// ==========================================
// SIGNUP STATE
// ==========================================

const signupState = {
    imageFile: null,
    imageUrl: null
};


// ==========================================
// ELEMENTS
// ==========================================

const photoInput =
    document.getElementById("photo");

const photoUploadInput =
    document.getElementById("photo-upload");

const signupPhotoStep =
    document.getElementById("signup-photo-step");

const signupProfileStep =
    document.getElementById("signup-profile-step");

const signupView =
    document.getElementById("signup-view");

const finalPhoto =
    document.getElementById("final-photo");


// ==========================================
// IMAGE SELECTED
// ==========================================

function handleImageSelected(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        alert("Välj en bildfil.");

        return;
    }

    signupState.imageFile = file;

    console.log(
        "📸 Image selected:",
        file.name
    );

    showProfileStep();
}


// ==========================================
// SHOW PROFILE FORM
// ==========================================

function showProfileStep() {

    if (signupState.imageUrl) {

        URL.revokeObjectURL(
            signupState.imageUrl
        );
    }

    signupState.imageUrl =
        URL.createObjectURL(
            signupState.imageFile
        );

    finalPhoto.src =
        signupState.imageUrl;

    signupPhotoStep.classList.remove(
        "active"
    );

    signupProfileStep.classList.add(
        "active"
    );

    console.log(
        "📸 Showing profile"
    );
}


// ==========================================
// READ PROFILE FORM
// ==========================================

function getProfileData() {

    const name =
        document
            .getElementById("name")
            .value
            .trim();

    const alias =
        document
            .getElementById("alias")
            .value
            .trim();

    const saunaOil =
        document
            .getElementById("sauna-oil")
            .value
            .trim();

    const favoriteTemperature =
        document
            .getElementById(
                "favorite-temperature"
            )
            .value;

    const motto =
        document
            .getElementById("motto")
            .value
            .trim();


    return {

        name,

        alias,

        saunaOil,

        favoriteTemperature,

        motto
    };
}


// ==========================================
// VALIDATE PROFILE
// ==========================================

function validateProfile(
    profileData
) {

    if (!profileData.name) {

        alert(
            "Skriv ditt namn."
        );

        return false;
    }


    if (!profileData.alias) {

        alert(
            "Skriv ditt bastualias."
        );

        return false;
    }


    if (
        !profileData.favoriteTemperature
    ) {

        alert(
            "Ange din favorittemperatur."
        );

        return false;
    }


    return true;
}


// ==========================================
// UPLOAD PHOTO
// ==========================================

async function uploadParticipantPhoto(
    participantId
) {

    if (!signupState.imageFile) {

        throw new Error(
            "Ingen bild vald."
        );
    }


    const file =
        signupState.imageFile;


    const fileExtension =
        file.name
            .split(".")
            .pop()
            ?.toLowerCase() || "jpg";


    const filePath =
        `${participantId}/portrait.${fileExtension}`;


    console.log(
        "📤 Uploading photo:",
        filePath
    );


    const {
        error
    } = await supabaseClient
        .storage
        .from(
            "festival2026-deltagare"
        )
        .upload(
            filePath,
            file,
            {
                upsert: true,
                contentType: file.type
            }
        );


    if (error) {

        console.error(
            "❌ Photo upload failed:",
            error
        );

        throw error;
    }


    console.log(
        "✅ Photo uploaded:",
        filePath
    );


    return filePath;
}


// ==========================================
// SHOW SIGNUP COMPLETE UI
// ==========================================

function showSignupComplete(
    participant,
    photoPath
) {

    console.log(
        "🎉 Showing signup complete"
    );


    // --------------------------------------
    // Hide signup form
    // --------------------------------------

    signupPhotoStep?.classList.remove(
        "active"
    );

    signupProfileStep?.classList.remove(
        "active"
    );


    // --------------------------------------
    // Create completion screen
    // --------------------------------------

    let completeView =
        document.getElementById(
            "signup-complete"
        );


    if (!completeView) {

        completeView =
            document.createElement(
                "section"
            );

        completeView.id =
            "signup-complete";

        completeView.className =
            "signup-complete";


        completeView.innerHTML = `

            <div class="signup-complete-card">

                <div class="signup-complete-icon">
                    ✓
                </div>

                <h1>
                    Du är registrerad!
                </h1>

                <p>
                    Välkommen till
                    Saunafestival 2026.
                </p>

                <div class="signup-complete-profile">

                    <div class="signup-complete-avatar">
                        <img
                            id="signup-complete-avatar"
                            alt="Din profilbild"
                        >
                    </div>

                    <div>

                        <strong
                            id="signup-complete-name"
                        ></strong>

                        <span
                            id="signup-complete-alias"
                        ></span>

                    </div>

                </div>

                <div class="signup-complete-message">

                    Din festivalprofil är skapad.

                </div>

            </div>
        `;


        signupView
            ?.querySelector(
                ".app-container"
            )
            ?.appendChild(
                completeView
            );
    }


    // --------------------------------------
    // Fill data
    // --------------------------------------

    const avatar =
        document.getElementById(
            "signup-complete-avatar"
        );

    const name =
        document.getElementById(
            "signup-complete-name"
        );

    const alias =
        document.getElementById(
            "signup-complete-alias"
        );


    if (avatar) {

        avatar.src =
            signupState.imageUrl;
    }


    if (name) {

        name.textContent =
            participant.name;
    }


    if (alias) {

        alias.textContent =
            `@${participant.alias}`;
    }


    completeView.classList.add(
        "active"
    );
}


// ==========================================
// CREATE PROFILE HEADER
// ==========================================

function createProfileHeader(
    participant
) {

    let profile =
        document.getElementById(
            "festival-profile"
        );


    if (profile) {

        return profile;
    }


    profile =
        document.createElement(
            "div"
        );

    profile.id =
        "festival-profile";

    profile.className =
        "festival-profile";


    profile.innerHTML = `

        <button
            type="button"
            class="festival-profile-button"
            id="festival-profile-button"
            aria-expanded="false"
            aria-label="Öppna min profil"
        >

            <div class="festival-profile-avatar">

                <img
                    id="festival-profile-avatar"
                    alt="Profilbild"
                >

            </div>

            <div class="festival-profile-name">

                <strong
                    id="festival-profile-name"
                ></strong>

                <span
                    id="festival-profile-alias"
                ></span>

            </div>

        </button>


        <div
            class="festival-profile-overview"
            id="festival-profile-overview"
        >

            <div class="profile-overview-header">

                <div class="profile-overview-avatar">

                    <img
                        id="profile-overview-avatar"
                        alt="Profilbild"
                    >

                </div>

                <div>

                    <strong
                        id="profile-overview-name"
                    ></strong>

                    <span
                        id="profile-overview-alias"
                    ></span>

                </div>

            </div>


            <div class="profile-overview-divider"></div>


            <div class="profile-stat">

                <span>
                    Bastuolja
                </span>

                <strong
                    id="profile-stat-oil"
                >
                    —
                </strong>

            </div>


            <div class="profile-stat">

                <span>
                    Favorittemperatur
                </span>

                <strong>
                    <span
                        id="profile-stat-temperature"
                    >
                        —
                    </span>
                    °C
                </strong>

            </div>


            <div class="profile-stat">

                <span>
                    Motto
                </span>

                <strong
                    id="profile-stat-motto"
                >
                    —
                </strong>

            </div>


            <div class="profile-stat">

                <span>
                    Kurs
                </span>

                <strong
                    id="profile-stat-course"
                >
                    Ej påbörjad
                </strong>

            </div>

        </div>
    `;


    document.body.appendChild(
        profile
    );


    return profile;
}


// ==========================================
// UPDATE PROFILE HEADER
// ==========================================

function updateProfileHeader(
    participant
) {

    const profile =
        createProfileHeader(
            participant
        );


    const avatar =
        document.getElementById(
            "festival-profile-avatar"
        );

    const overviewAvatar =
        document.getElementById(
            "profile-overview-avatar"
        );

    const name =
        document.getElementById(
            "festival-profile-name"
        );

    const alias =
        document.getElementById(
            "festival-profile-alias"
        );

    const overviewName =
        document.getElementById(
            "profile-overview-name"
        );

    const overviewAlias =
        document.getElementById(
            "profile-overview-alias"
        );

    const oil =
        document.getElementById(
            "profile-stat-oil"
        );

    const temperature =
        document.getElementById(
            "profile-stat-temperature"
        );

    const motto =
        document.getElementById(
            "profile-stat-motto"
        );

    const course =
        document.getElementById(
            "profile-stat-course"
        );


    // --------------------------------------
    // Avatar
    // --------------------------------------

    let imageUrl =
        signupState.imageUrl;


    if (
        !imageUrl &&
        participant.photo_path
    ) {

        const {
            data
        } = supabaseClient
            .storage
            .from(
                "festival2026-deltagare"
            )
            .getPublicUrl(
                participant.photo_path
            );

        imageUrl =
            data?.publicUrl;
    }


    if (imageUrl) {

        if (avatar) {

            avatar.src =
                imageUrl;
        }

        if (overviewAvatar) {

            overviewAvatar.src =
                imageUrl;
        }
    }


    // --------------------------------------
    // Identity
    // --------------------------------------

    if (name) {

        name.textContent =
            participant.name || "";
    }

    if (alias) {

        alias.textContent =
            `@${participant.alias || ""}`;
    }

    if (overviewName) {

        overviewName.textContent =
            participant.name || "";
    }

    if (overviewAlias) {

        overviewAlias.textContent =
            `@${participant.alias || ""}`;
    }


    // --------------------------------------
    // Stats
    // --------------------------------------

    if (oil) {

        oil.textContent =
            participant.sauna_oil || "—";
    }


    if (temperature) {

        temperature.textContent =
            participant.favorite_temperature
                ?? "—";
    }


    if (motto) {

        motto.textContent =
            participant.motto || "—";
    }


    if (course) {

        course.textContent =
            participant.course_completed
                ? "Klar ✓"
                : "Ej påbörjad";
    }


    // --------------------------------------
    // Profile toggle
    // --------------------------------------

    const profileButton =
        document.getElementById(
            "festival-profile-button"
        );

    const overview =
        document.getElementById(
            "festival-profile-overview"
        );


    if (
        profileButton &&
        overview
    ) {

        profileButton.onclick = (
            event
        ) => {

            event.stopPropagation();

            const isOpen =
                profile.classList.toggle(
                    "profile-open"
                );

            profileButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        };


        document.addEventListener(
            "click",
            () => {

                profile.classList.remove(
                    "profile-open"
                );

                profileButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

            },
            {
                once: false
            }
        );


        overview.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

            }
        );
    }


    // --------------------------------------
    // Make visible
    // --------------------------------------

    profile.classList.add(
        "visible"
    );
}


// ==========================================
// REGISTER PARTICIPANT
// ==========================================

async function registerParticipant() {

    const submitButton =
        document.getElementById(
            "signup-submit"
        );

    const status =
        document.getElementById(
            "signup-status"
        );


    const profileData =
        getProfileData();


    console.log(
        "👤 Profile data:",
        profileData
    );


    // --------------------------------------
    // Validate
    // --------------------------------------

    if (
        !validateProfile(
            profileData
        )
    ) {

        return;
    }


    // --------------------------------------
    // Prevent double click
    // --------------------------------------

    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Registrerar...";
    }


    if (status) {

        status.textContent =
            "Skapar din festivalprofil...";
    }


    try {

        // ----------------------------------
        // CREATE PARTICIPANT
        // ----------------------------------

        const {
            data,
            error
        } = await supabaseClient

            .from(
                "festival2026_deltagare"
            )

            .insert({

                name:
                    profileData.name,

                alias:
                    profileData.alias,

                sauna_oil:
                    profileData.saunaOil,

                favorite_temperature:
                    Number(
                        profileData.favoriteTemperature
                    ),

                motto:
                    profileData.motto

            })

            .select()

            .single();


        if (error) {

            console.error(
                "❌ Could not create participant:",
                error
            );

            throw error;
        }


        console.log(
            "✅ Participant created:",
            data
        );


        // ----------------------------------
        // SAVE SESSION
        // ----------------------------------

        saveParticipantSession(
            data.id
        );


        console.log(
            "💾 Participant session saved:",
            data.id
        );


        // ----------------------------------
        // UPLOAD PHOTO
        // ----------------------------------

        let photoPath =
            null;


        try {

            photoPath =
                await uploadParticipantPhoto(
                    data.id
                );


            // ------------------------------
            // SAVE PHOTO PATH
            // ------------------------------

            const {
                error:
                    photoPathError
            } =
                await supabaseClient

                    .from(
                        "festival2026_deltagare"
                    )

                    .update({

                        photo_path:
                            photoPath

                    })

                    .eq(
                        "id",
                        data.id
                    );


            if (
                photoPathError
            ) {

                throw photoPathError;
            }


            console.log(
                "✅ Photo path saved:",
                photoPath
            );


            data.photo_path =
                photoPath;


        } catch (
            uploadError
        ) {

            console.error(
                "❌ Photo upload failed:",
                uploadError
            );

            throw uploadError;
        }


        // ----------------------------------
        // SHOW PROFILE
        // ----------------------------------

        updateProfileHeader(
            data
        );


        // ----------------------------------
        // SHOW COMPLETE
        // ----------------------------------

        showSignupComplete(
            data,
            photoPath
        );


        // ----------------------------------
        // STATUS
        // ----------------------------------

        if (status) {

            status.textContent =
                "Registreringen är klar!";
        }


        await window.saunaFestival.participantReady(
            data
        );


        console.log(
            "🎉 Signup completed successfully!"
        );


    } catch (error) {

        console.error(
            "❌ Signup failed:",
            error
        );


        if (status) {

            status.textContent =
                "Något gick fel. Försök igen.";
        }


        alert(
            "Kunde inte registrera dig. Kontrollera konsolen."
        );


        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Registrera mig →";
        }
    }
}


// ==========================================
// INIT
// ==========================================

function initSignup() {

    console.log(
        "📸 Signup initialized"
    );


    // --------------------------------------
    // Photo
    // --------------------------------------

    photoInput?.addEventListener(
        "change",
        handleImageSelected
    );


    photoUploadInput?.addEventListener(
        "change",
        handleImageSelected
    );


    // --------------------------------------
    // Submit
    // --------------------------------------

    document
        .getElementById(
            "signup-submit"
        )
        ?.addEventListener(
            "click",
            registerParticipant
        );


    console.log(
        "📸 Signup event listeners ready"
    );
}


// ==========================================
// START
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    initSignup
);