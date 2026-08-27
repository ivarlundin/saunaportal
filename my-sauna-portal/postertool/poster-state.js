// =================================
// POSTER STATE
// =================================

const posterState = {

    title: "",

    subtitle: "",

    participants: [],

    style: {

        columns: 4,

        gap: 5

    }

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