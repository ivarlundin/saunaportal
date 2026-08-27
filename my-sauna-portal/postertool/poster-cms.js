// =================================
// POSTER CMS
// =================================

function renderParticipants() {

    const container =
        document.getElementById(
            "participants-list"
        );

    const count =
        document.getElementById(
            "participant-count"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const visibleCount =
        posterState.participants
            .filter(
                participant =>
                    participant.visible
            )
            .length;


    if (count) {

        count.textContent =
            `${visibleCount}/${posterState.participants.length}`;

    }


    posterState.participants.forEach(
        (
            participant,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "participant-row";


            row.draggable = true;

            row.dataset.index =
                index;


            if (!participant.visible) {

                row.classList.add(
                    "hidden"
                );

            }


            // =================================
            // DRAG HANDLE
            // =================================

            const dragHandle =
                document.createElement(
                    "div"
                );

            dragHandle.className =
                "drag-handle";

            dragHandle.textContent =
                "☰";


            // =================================
            // IMAGE
            // =================================

            const image =
                document.createElement(
                    "img"
                );

            image.className =
                "participant-thumb";

            image.src =
                getPhotoUrl(
                    participant.photo_path
                );

            image.alt =
                participant.name;


            // =================================
            // NAME
            // =================================

            const name =
                document.createElement(
                    "div"
                );

            name.className =
                "participant-name";

            name.textContent =
                participant.name;


            // =================================
            // VISIBILITY
            // =================================

            const visibilityButton =
                document.createElement(
                    "button"
                );

            visibilityButton.className =
                "visibility-button";

            visibilityButton.type =
                "button";

            visibilityButton.textContent =
                participant.visible
                    ? "👁"
                    : "🚫";


            visibilityButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    participant.visible =
                        !participant.visible;


                    renderParticipants();

                    renderPoster();

                }
            );


            // =================================
            // BUILD ROW
            // =================================

            row.appendChild(
                dragHandle
            );

            row.appendChild(
                image
            );

            row.appendChild(
                name
            );

            row.appendChild(
                visibilityButton
            );


            container.appendChild(
                row
            );

        }
    );


    setupDragAndDrop();
}


// =================================
// DRAG & DROP
// =================================

function setupDragAndDrop() {

    const rows =
        document.querySelectorAll(
            ".participant-row"
        );


    let draggedIndex = null;


    rows.forEach(
        row => {

            row.addEventListener(
                "dragstart",
                () => {

                    draggedIndex =
                        Number(
                            row.dataset.index
                        );

                }
            );


            row.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();

                }
            );


            row.addEventListener(
                "drop",
                event => {

                    event.preventDefault();


                    const targetIndex =
                        Number(
                            row.dataset.index
                        );


                    if (
                        draggedIndex === null ||
                        draggedIndex === targetIndex
                    ) {

                        return;

                    }


                    const participants =
                        posterState.participants;


                    const movedParticipant =
                        participants.splice(
                            draggedIndex,
                            1
                        )[0];


                    participants.splice(
                        targetIndex,
                        0,
                        movedParticipant
                    );


                    renderParticipants();

                    renderPoster();

                }
            );

        }
    );
}