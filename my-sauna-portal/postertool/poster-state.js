// =================================
// POSTER STATE
// =================================

const posterState = {

    title: "",

    subtitle: "",

    participants: []

};


// =================================
// SET PARTICIPANTS
// =================================

function setParticipants(
    participants
) {

    posterState.participants =
        participants.map(
            participant => ({

                ...participant,

                visible: true

            })
        );

}