import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';
import { annotation, extensionMessage, sheet } from './customTypes';
import { checkNullableObject } from './shared';

const currentOriginAndPath = window.location.origin + window.location.pathname;

const currentSheet: sheet = {
    id: currentOriginAndPath,
    active: false,
    annotations: [],
    backgroundPort: undefined,
    csPort: undefined,
    tabId: -2,
    url: currentOriginAndPath
};

// ========================
// Testing
// ========================

currentSheet.annotations.push({
    id: 1,
    comment: 'blam',
    created: new Date(Date.now()),
    colour: '',
    userName: 'JohnnyAppleseed',
    userProfileURL: ''
});

// ========================
// General functions
// ========================

// Get the Enums

let enums: any;

async function getEnums() {
    const enumURL: string = chrome.runtime.getURL('/assets/enums.json');
    enums = await fetch(enumURL).then(response => response.json());
    console.log('enums');
    console.log(enums);
}

function toggleSheetActiveState(active: boolean): void {
    if (active) {
        // Remove content script contents
        const shadowContainer = checkNullableObject(document.querySelector('#shadowContainer'));
        shadowContainer.parentNode.removeChild(shadowContainer);
    } else {
        //Add extension elements
        checkNullableObject(document.body.insertAdjacentHTML('afterbegin',
            '<div id="shadowContainer"></div>'
        ));

        const shadowContainer: HTMLElement = checkNullableObject(document.querySelector('div#shadowContainer'));
        const shadow = shadowContainer.attachShadow({ mode: 'open' });

        // Render react components inside shadow dom
        ReactDOM.render(
            <CardsContainer
                storageAnnotations={currentSheet.annotations}
            />,
            shadow
        );

        // Import styling for shadow dom
        const shadowDiv = checkNullableObject(shadow.querySelector('#shadowDiv'));
        const cardsContainerCssURL = chrome.runtime.getURL('/contentScript/cardsContainer.css');
        fetch(cardsContainerCssURL).then(response => response.text()).then(data => {
            shadowDiv.insertAdjacentHTML('afterbegin', `<style> ${data} </style>`);
        });
    }
}

// ========================
// Storage management
// ========================

// send the sheet to thr background to be added or to update a pre existing sheet in the background state
function sendSheetToBackground() {
    currentSheet.csPort.postMessage({
        subject: enums.chromeMessageSubject.sheetToAddOrUpdate,
        attachments: {
            sheet: currentSheet
        }
    });
}

// ========================
// Chrome messaging
// ========================

// handle message from backend
async function handleMessage(message: extensionMessage): Promise<boolean> {
    console.log(enums);
    switch (message.subject) {
        case enums.chromeMessageSubject.toggleSheetActiveState:
            console.log('ace change' + message.attachments.activeState);
            toggleSheetActiveState(message.attachments.activeState);
            break;
        case enums.chromeMessageSubject.backgroundScriptConnected:
            currentSheet.tabId = message.attachments.tabId;
            sendSheetToBackground();
            break;
        default:
            console.error('invalid Enum for message subject: "' + message.subject + '"');
            break;
    }
    return true;
}

function setupChromeMessaging() {
    //update to use a UUID or tab name
    currentSheet.csPort = chrome.runtime.connect({ name: currentSheet.id })

    currentSheet.csPort.postMessage({ subject: enums.chromeMessageSubject.openingPort });

    currentSheet.csPort.onMessage.addListener(function (message: extensionMessage) {
        console.log('');
        console.log(`Content script received message from background script ${message.subject}`)
        handleMessage(message);
    });
}

// ========================
// React components
// ========================

function CardsContainer(props: any): ReactElement {
    const [annotations, setAnnotations] = React.useState(props.storageAnnotations as annotation[]);

    const newAnnotation: annotation = {
        id: annotations.length,
        comment: 'test',
        created: new Date(Date.now()),
        colour: '',
        userProfileURL: '',
        userName: 'Test Name'
    }

    // Similar to componentDidMount and componentDidUpdate:
    React.useEffect(() => {
        // Update the document title using the browser API
        document.title = document.title + ` : (Acetate Active) - ${annotations.length} annotations`;
    }, [annotations]);

    function addDummyAnnotation(): void {
        setAnnotations(annotations.concat([newAnnotation]));
    }

    function deleteAnnotation(annotationId: number): void {
        const deleteConfirmed: boolean = window.confirm('Are you sure you want to delete this annotation?');
        if (deleteConfirmed) {
            const annotationsClone: annotation[] = annotations.filter(annotation => annotation.id !== annotationId);
            setAnnotations(annotationsClone);
        }
    }

    const cards = annotations.map((annotation) => {
        return (
            <AnnotationCard
                key={annotation.id}
                annotationData={annotation}
                annotationMethods={{ deleteAnnotation }}
            />
        )
    })

    return (
        <div id='shadowDiv'>
            <ol className='cardsContainer'>
                {cards}
            </ol>
        </div>
    );
}

function AnnotationCard(props: any): ReactElement {
    const [annotationData, setAnnotationData] = React.useState(props.annotationData);
    const [annotationComment, setAnnotationComment] = React.useState(props.annotationData.comment);

    const deleteAnnotation = (annotationId: number): void => props.annotationMethods.deleteAnnotation(annotationId);
    const [editMode, setEditMode] = React.useState(false as boolean);

    function extractInitials(): string {
        const userName = annotationData.userName;
        const matches = checkNullableObject(userName.match(/\b(\w)/g));
        return matches.join('');
    }

    function saveComment(newComment: string): void {
        props.annotationData.comment = newComment;
        setEditMode(false);
    }

    return (
        <li
            className={`annotationCard ${editMode ? 'edit' : ''}`}
            style={{ backgroundColor: `${annotationData.colour}` }}
        >
            <div className='userID'>
                <CardIdentifier
                    userProfileURL={annotationData.userProfileURL}
                    userInitials={extractInitials()}
                />
            </div>
            <div className='cardMain'>
                <div className='cardHeader'>
                    <div className='cardTitle'>
                        <p className='username'>{annotationData.userName}</p>
                        <p className='created'>Created: {annotationData.created.toLocaleDateString()}</p>
                    </div>
                    <div className='controls'>
                        <p
                            title='Edit'
                            onClick={
                                (): void => { editMode ? saveComment(annotationComment) : setEditMode(true) }
                            }
                        >
                            {editMode ? 'Done' : 'Edit'}
                        </p>
                        <p
                            title='Delete'
                            onClick={(): void => { deleteAnnotation(annotationData.id) }}
                        >
                            Delete
                        </p>
                        {/* 
                            
                            Will props move this out of this menu? Need to think about it when its working
                            
                            <p title='Begin Thread (Coming soon!)'>
                            &#128284;
                            </p> */}
                    </div>
                </div>
                <div className='cardBody'>
                    <textarea
                        disabled={!editMode}
                        value={annotationComment}
                        onChange={(e): void => setAnnotationComment(e.target.value)}
                    />
                </div>
            </div>
        </li>
    )
}

function CardIdentifier(props: any): ReactElement {
    const userProfileURL: string = props.userProfileURL;
    const userInitials: string = props.userInitials;

    if (userProfileURL !== '') {
        return <img alt='userProfile' src={userProfileURL}></img>
    }
    else {
        return <p className='initials'>{userInitials}</p>
    }
}

// ========================
// Initiate
// ========================

getEnums().then(() => setupChromeMessaging());