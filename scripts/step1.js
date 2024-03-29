// Define an object to act as the controller for this step
function Step1() {
}

Step1.FLOW_ACTIONS = {
    PREVIOUS: 'PREVIOUS',
    YES: 'YES',
    NO: 'NO',
    NEXT: 'NEXT',
    SKIP: 'SKIP'
};

Step1.FLOW_TYPES = {
    QUESTION: 'QUESTION',
    CODE_FIELDS: 'CODE_FIELDS',
    WIZARD: 'WIZARD'
};

Step1.DEFAULT_FLOW_WEIGHTS = {
    'QUESTION': 1,
    'CODE_FIELDS': 5,
    'WIZARD': 3
};

Step1.ATTACHMENTS_WEIGHT = 5;
Step1.SIGN_WEIGHT = 3;


// Flow of questions and code fields
Step1.FLOW = [
    {
        type: Step1.FLOW_TYPES.QUESTION,
        text: 'Ontvangt u pensioen omdat u werknemer bent geweest in België, of omdat u voor een werkgever heeft gewerkt gevestigd in België?',
        yes: [
            {
                type: Step1.FLOW_TYPES.CODE_FIELDS,
                category: 'B. BEDRIJFSVOORHEFFING.',
                subcategory: ''
            },
            {
                type: Step1.FLOW_TYPES.QUESTION,
                text: 'Bent u blijvend arbeidsongeschikt, en ontvangt u hiervoor een vergoeding?',
                yes: [
                    {
                        type: Step1.FLOW_TYPES.CODE_FIELDS,
                        category: 'A. PENSIOENEN',
                        subcategory: '2. Arbeidsongevallen en beroepsziekten (wettelijke vergoedingen wegens blijvende ongeschiktheid).'
                    }
                ],
                no: []
            }
        ],
        no: []
    },
    {
        type: Step1.FLOW_TYPES.QUESTION,
        text: 'Doet u aan pensioensparen via een daarvoor geopende spaarrekening of spaarverzekering, en heeft u hiervoor reeds een uitkering ontvangen?',
        yes: [
            {
                type: Step1.FLOW_TYPES.CODE_FIELDS,
                category: 'A. PENSIOENEN',
                subcategory: '3. Pensioensparen.'
            },
            {
                type: Step1.FLOW_TYPES.CODE_FIELDS,
                category: 'A. PENSIOENEN',
                subcategory: '4. Niet ingehouden persoonlijke sociale bijdragen:'
            }
        ],
        no: []
    },
    {
        type: Step1.FLOW_TYPES.QUESTION,
        text: 'Ontvangt u pensioenen, anders dan uit pensioensparen en vergoedingen voor arbeidsongeschiktheid?',
        yes: [
            {
                type: Step1.FLOW_TYPES.CODE_FIELDS,
                category: 'A. PENSIOENEN',
                subcategory: '1. Andere dan de onder 2 en 3 bedoelde pensioenen.'
            },
            {
                type: Step1.FLOW_TYPES.QUESTION,
                text: 'Ontvangt u pensioenen van buitenlandse oorsprong?',
                yes: [
                    {
                        type: Step1.FLOW_TYPES.CODE_FIELDS,
                        category: 'C. PENSIOENEN VAN BUITENLANDSE OORSPRONG (EN DE DESBETREFFENDE KOSTEN).',
                        subcategory: ''
                    }
                ],
                no: []
            }
        ],
        no: []
    },
    {
        type: Step1.FLOW_TYPES.QUESTION,
        text: 'Heeft u kinderen die naar de kinderopvang gaan?',
        yes: [
            {
                type: Step1.FLOW_TYPES.WIZARD,
                method: 'setDayCareWizard'
            }
        ],
        no: []
    }
];

// Copy of the flow to work with
Step1.flow = JSON.parse(JSON.stringify(Step1.FLOW));

// Queue for keeping track of the steps that still need to be done
Step1.flowQueue = null;

// List of actions that the user has previously taken
Step1.flowHistory = null;

// Properties for keeping track of progress
Step1.weight = undefined;
Step1.weightCompleted = 0;

// This method gets called when the session enters this step
Step1.run = function () {
    if (Step1.flowQueue == null) {
        Step1.reset();
    } else if (Step1.flowQueue.length == 0) {
        Step1.traverseFlow(Step1.FLOW_ACTIONS.PREVIOUS);
    }

    Step1.setUpCurrentStep();
};

// Undo all progress in this step
Step1.reset = function () {
    Step1.flowQueue = [];
    Step1.flowHistory = [];

    clearAllSavedData();

    Step1.flow.forEach(function(step) {
        Step1.flowQueue.push(step);
    });
};

// Get the estimated amount of work this step requires
Step1.getWeight = function () {
    if (typeof Step1.weight === 'undefined') {
        Step1.weight = Step1.getTreeWeight(Step1.FLOW);
    }

    return Step1.weight;
};

// Get the estimated amount of work already done in this step
Step1.getWeightCompleted = function () {
    return Step1.weightCompleted;
};

Step1.getTreeWeight = function (value) {
    var weight = 0;

    value.forEach(function(step) {
        if ('weight' in step) {
            weight += step.weight;
        } else {
            weight += Step1.DEFAULT_FLOW_WEIGHTS[step.type];
        }

        if (step.type == Step1.FLOW_TYPES.QUESTION) {
            weight += Step1.getTreeWeight(step.yes);
            weight += Step1.getTreeWeight(step.no);
        }
    });

    return weight;
};

// Set up the current step to enable the user to execute it
Step1.setUpCurrentStep = function () {
    Step1.weightCompleted = Step1.getWeight() - Step1.getTreeWeight(Step1.flowQueue);
    Session.updateProgress();

    if (Step1.flowQueue.length <= 0) {
        Session.nextStep();

        return true;
    }

    currentStep = Step1.flowQueue[0];

    if (currentStep.type == Step1.FLOW_TYPES.QUESTION) {
        Step1.setQuestion(currentStep.text);
    } else if (currentStep.type == Step1.FLOW_TYPES.CODE_FIELDS) {
        Step1.setCodeFields(currentStep.category, currentStep.subcategory);
    } else if (currentStep.type == Step1.FLOW_TYPES.WIZARD) {
        window['UI'][currentStep.method]();

        Session.setPossibleActions([
            Step1.getPreviousButton(),
            ['Step1.traverseFlow(Step1.FLOW_ACTIONS.NEXT);', 'Volgende', Session.ACTION_TYPES.PRIMARY],
            Step1.getSkipButton()
        ]);
    }
};

// Traverse the flow, possibly based on the given answer
Step1.traverseFlow = function (action) {
    if (Step1.flowQueue.length <= 0 && action != Step1.FLOW_ACTIONS.PREVIOUS) {
        return false;
    }

    if (action == Step1.FLOW_ACTIONS.SKIP) {
        Step1.flowQueue.push(Step1.flowQueue.shift());
        Step1.flowHistory.push(null);
    } else if (action == Step1.FLOW_ACTIONS.YES) {
        var currentStep = Step1.flowQueue.shift();

        if (currentStep.type == Step1.FLOW_TYPES.QUESTION) {
            Step1.flowHistory.push(currentStep.yes.length);

            for (var i = currentStep.yes.length - 1; i >= 0; i--) {
                Step1.flowQueue.unshift(currentStep.yes[i]);
            }
        }

        Step1.flowHistory.push(currentStep);
    } else if (action == Step1.FLOW_ACTIONS.NO) {
        var currentStep = Step1.flowQueue.shift();

        if (currentStep.type == Step1.FLOW_TYPES.QUESTION) {
            Step1.flowHistory.push(currentStep.no.length);

            for (var i = currentStep.no.length - 1; i >= 0; i--) {
                Step1.flowQueue.unshift(currentStep.no[i]);
            }
        }

        Step1.flowHistory.push(currentStep);
    } else if (action == Step1.FLOW_ACTIONS.NEXT) {
        Step1.flowHistory.push(Step1.flowQueue.shift());
    } else if (action == Step1.FLOW_ACTIONS.PREVIOUS && Step1.flowHistory.length > 0) {
        var step = Step1.flowHistory.pop();

        if (step === null) {
            Step1.flowQueue.unshift(Step1.flowQueue.pop());
        } else {
            if (step.type == Step1.FLOW_TYPES.QUESTION) {
                var number = Step1.flowHistory.pop();

                for (var i = 0; i < number; i++) {
                    Step1.flowQueue.shift();
                }
            }

            Step1.flowQueue.unshift(step);
        }
    }

    Step1.setUpCurrentStep();
};

// Convey the given question to the user
Step1.setQuestion = function (value) {
    Session.setContent('<span class="question">' + value + '</span>');

    Session.setPossibleActions([
        Step1.getPreviousButton(),
        ['Step1.traverseFlow(Step1.FLOW_ACTIONS.YES);', 'Ja', Session.ACTION_TYPES.PRIMARY],
        ['Step1.traverseFlow(Step1.FLOW_ACTIONS.NO);', 'Nee', Session.ACTION_TYPES.PRIMARY],
        Step1.getSkipButton(true)
    ]);
};

// Prompt the user to fill in the given code fields
Step1.setCodeFields = function (category, subcategory) {
    UI.setCodeFields(category, subcategory);

    Session.setPossibleActions([
        Step1.getPreviousButton(),
        ['Step1.traverseFlow(Step1.FLOW_ACTIONS.NEXT);', 'Volgende', Session.ACTION_TYPES.PRIMARY],
        Step1.getSkipButton()
    ]);
};

Step1.getPreviousButton = function () {
    if (Step1.flowHistory.length > 0) {
        return ['Step1.traverseFlow(Step1.FLOW_ACTIONS.PREVIOUS);', 'Vorige', Session.ACTION_TYPES.SECONDARY];
    } else {
        return ['', 'Vorige', Session.ACTION_TYPES.SECONDARY, false];
    }
};

Step1.getSkipButton = function (isQuestion) {
    var text = 'Later invullen';

    if (isQuestion) {
        text = 'Later beantwoorden';
    }

    if (Step1.flowQueue.length > 1) {
        return ['Step1.traverseFlow(Step1.FLOW_ACTIONS.SKIP);', text, Session.ACTION_TYPES.SECONDARY];
    } else {
        return ['', text, Session.ACTION_TYPES.SECONDARY, false];
    }
};





































/* you can fill in multiple of the same field for these questions */
var multipleFields = [288, 211, 255, 425];

var infoIconCodes = ["_A_1", "_A_2", "_A_2_a", "_A_2_b", "_A_2_c2", "_A_3", "_A_4", "_B_1_a", "_B_1_b", "_B_2_a", "_B_2_b", "_C"];

var infoURL = "https://ccff02.minfin.fgov.be/towsimu/app/citizen/public/taxform/bookHelp.do?cadre=V&contentkey=application_help_0102#anchor";

/* every question has only 1 field */
var fields =
    {"A. PENSIOENEN": {
        "1. Andere dan de onder 2 en 3 bedoelde pensioenen.": {
            "a) Wettelijke pensioenen verkregen vanaf de wettelijke pensioenleeftijd:": 288,
            "b) Totaal van rubriek a:": 1228,
            "c) Achterstallen van onder a bedoelde wettelijke pensioenen:": 1230,
            "d) Overlevingspensioenen en overgangsuitkeringen:": 1229,
            "e) Achterstallen van overlevingspensioenen:": 1231,
            "f) Andere pensioenen, renten (behalve omzettingsrenten) en als zodanig geldende kapitalen, afkoopwaarden, enz., die gezamenlijk belastbaar zijn:": 211,
            "g) Totaal van rubriek f:": 1211,
            "h) Achterstallen van onder f bedoelde pensioenen, renten, enz.:": 1212,
            "i) Kapitalen en afkoopwaarden die afzonderlijk belastbaar zijn:": {
                "1° tegen 33% :": 1213,
                "2° tegen 20% :": 1245,
                "3° tegen 18% :": 1253,
                "4° tegen 16,5% :": {
                    "a. gekapitaliseerde waarde van wettelijke pensioenen verkregen vanaf de wettelijke pensioenleeftijd:": 1232,
                    "b. gekapitaliseerde waarde van overlevingspensioenen:": 1237,
                    "c. andere:": 1214
                },
                "5° tegen 10% :": 1215
            },

            "j) Omzettingsrenten van kapitalen en afkoopwaarden die zijn betaald of toegekend": {
                "1° in 2015:": 1216,
                "2° tijdens de jaren 2003 tot 2014:": 1218
            }
        },
        "2. Arbeidsongevallen en beroepsziekten (wettelijke vergoedingen wegens blijvende ongeschiktheid).": {
            "a) Uitkeringen, toelagen en renten (behalve omzettingsrenten):": 1217,
            "b) Achterstallen van onder a bedoelde uitkeringen:": 1224,
            "c) Omzettingsrenten van kapitalen betaald of toegekend:": {
                "1° in 2015:": 1226,
                "2° tijdens de jaren 2003 tot 2014:": 1227
            }
        },
        "3. Pensioensparen.": {
            "a) Pensioenen, renten, spaartegoeden, kapitalen en afkoopwaarden die gezamenlijk belastbaar zijn:": 1219,
            "b) Spaartegoeden, kapitalen en afkoopwaarden die afzonderlijk belastbaar zijn:": {
                "1° tegen 33% :": 1220,
                "2° tegen 16,5% :": 1221,
                "3° tegen 8% :": 1222
            }
        },
        "4. Niet ingehouden persoonlijke sociale bijdragen:": 1223
    },
        "B. BEDRIJFSVOORHEFFING.":
            {"1. Verrekenbaar en terugbetaalbaar":
                {"a) Verrekenbaar en terugbetaalbaar volgens fiches:": 255,
                    "b) Totaal van rubriek a:": 1225},

                "2. Verrekenbaar, maar niet terugbetaalbaar":
                    {"a) Verrekenbaar, maar niet terugbetaalbaar volgens fiches:" : 425,
                        "b) Totaal van rubriek a:": 1425}
            },
        "C. PENSIOENEN VAN BUITENLANDSE OORSPRONG (EN DE DESBETREFFENDE KOSTEN).": {
            "Vermeld het land, de code waarnaast ze zijn ingevuld (bv. 1211) en het bedrag van de hierboven vermelde pensioenen van buitenlandse oorsprong (en de desbetreffende kosten) waarvoor u aanspraak maakt op belastingvermindering voor inkomsten van buitenlandse oorsprong (pensioenen die zijn vrijgesteld van de personenbelasting, maar in aanmerking worden genomen voor de berekening van de belasting op uw andere inkomsten, of waarvoor de belasting tot de helft wordt verminderd).": 0
        }
    };

/* id of inputfields with there value */
var fieldValues = {};
/* list of codes and the number of extra fields */
var numberOfExtraFields = {};
/* liest of of childrenValues for the wizard */
var childrenInfo = {};
/* result of the daycarewizard */
var result = 0;
/* saved sectionValues */
var sectionCValues = {};
var numberOfSectionValues = 1;
var numberOfChildren = 1;

var currentStep = 1;

/* Main flow of the tax return */
var flow = [
    "Vraag 1/5",
    "Vraag 2/5",
    "Vraag 3/5",
    "Vraag 4/5",
    "Vraag 5/5"
];

/*List of additional attachments*/
var attachments = [];


/* Completed parts of the flow */
var completed = [];


/* Update the page to match the current state of the tax return */
function renderPage() {
    var question;

    if (flow.length > 0) {
        question = flow[0];
    } else {
        question = 'Klaar!';
        UI.Content.setNextPrevButton();
        $('#action-button-previous').prop('disabled',true);
    }

    UI.setProgress(completed.length / (flow.length + completed.length));
    UI.Content.setQuestion(question);
}

/* Update page to match the additional attachments*/
function renderAttachments(){
    $('#attachments').empty();
    UI.Content.setAttachments(attachments);
}


/* Return to the previous page */
function previousPage() {
    if (flow.length > 0) {
        var page = flow.pop();
        flow.unshift(page);
        renderPage();
    }
}

/* Mark the current page as solved and go to the next page */
function nextPage() {
    if (flow.length > 0) {
        var page = flow.shift();
        completed.push(page);
        renderPage();
    }
}

/* Jump to the next page without resolving the current page */
function skipPage() {
    if (flow.length > 0) {
        var page = flow.shift();
        flow.push(page);
        renderPage();
    }
}

function ChangeStep(value){
    currentStep += value;
    UI.setCurrentStep(currentStep);
    var content = $('#content');
    content.empty();

    if(currentStep == 1)
        UI.setupQuestions(content);
    else if(currentStep == 2) {
        $('#action-button-previous').prop('disabled', false);
        UI.setupAttachmentStep(content);
        UI.Content.setNextPrevButton();
    }else if(currentStep == 3) {
        UI.setupSign(content);
        UI.Content.setSignButtons();
    }

}

function updateComment(index, value){
    attachments[index][1] = value;
}

function removeAttachment(index) {
    attachments.splice(index, 1);
    renderAttachments();
}

/* remove all attachments */
function removeAllAttachments() {
    attachments = [];
    renderAttachments();
}

/* get all files from input and save the names in attachment array */
function addFile(){
    var fileArray = $("#file").prop("files");
    for (var i = 0; i < fileArray.length; ++i) {
        var filename = fileArray.item(i).name.replace(/^.*[\\\/]/, '');

        /* add tupple [filename, comment] */
        attachments.push([filename, ""]);
    }
    $("#file").val("");
    renderAttachments();
}

/* when values in the wizard change, check if the result field or the others need to be disabled */
function checkDisableWizard() {
    /* get all the children*/
    var rows = $('#wizard-rows');
    var element = $('#result')[0];
    var children = rows[0].childNodes;
    var disableValue;

    if(element.value != 0){
        disableValue = true;
        result = element.value;
    }else {
        disableValue = false;
    }
    /* loop over the children en calculate there values */
    for(var i = 1; i < children.length; i++){
        /* get input field of the child */
        var childInfo = children[i].childNodes;
        childInfo[0].getElementsByTagName("input")[0].disabled = disableValue;
        childInfo[1].getElementsByTagName("input")[0].disabled = disableValue;
        childInfo[2].getElementsByTagName("input")[0].disabled = disableValue;
        childInfo[4].getElementsByTagName("input")[0].disabled = disableValue;
        document.getElementById("action-button-addChild").disabled = disableValue;
        document.getElementById("wizard-button-remove-all").disabled = disableValue;
    }
}

/* update daycare wizard result field when there is a value that changed */
function updateResult() {
    result = 0;
    /* get all the children*/
    var rows = $('#wizard-rows');
    var children = rows[0].childNodes;

    /* loop over the children en calculate there values */
    for(var i = 1; i < children.length; i++){
        /* get input field of the child */
        var childInfo = children[i].childNodes;

        /* get the 'dagtarief' and 'aantal dagen' values */
        var value1 = "" + childInfo[1].getElementsByTagName("input")[0].value;
        var value2 = childInfo[2].getElementsByTagName("input")[0].value;

        var val;
        if(value1.indexOf(",") > -1)
            val = Number(value1.replace(",", "."));
        else
            val = Number(value1);

        if(value1 != "" &&  value2 != "") {
            /* max value of dagtarief is 11.20 */
            if (val > 11.20)
                val = 11.20;

            var sum = val * value2;

            /* put the sum in the aftrekbaar bedrag field */
            childInfo[3].getElementsByTagName("input")[0].value = sum;
            result += sum;
        }else {
            childInfo[3].getElementsByTagName("input")[0].value = 0;
            $('#result')[0].value = result;
        }
    }

    /* check if we have to disable or enable the result field */
    if(result > 0)
        $('#result')[0].disabled = true;
    else
        $('#result')[0].disabled = false;

    /* put result in result field */
    $('#result')[0].value = result;

}

function testOnPositiveDouble(child){
    var value1 = child.value;
    if (value1 < 0) {
        child.value = "";
        activateErrorModal('<p>U heeft een negatieve waarde ingevoerd. Er worden enkel positieve waarden toegelaten.</p>');
        return;
    }

    var re = /^\d+(,|\.)?(\d+)?$/;
    /* test if there is only one , or . */
    if(value1 != "" && !re.test(value1)){
        child.value = "";
        activateErrorModal('<p>U mag enkel gebruik maken van cijfers en een punt of komma om cijfers na de komma aan te duiden.</p>');
        return;
    }
}

function testOnPositiveInteger(child){
    var value2 = child.value;
    /* check if there is a negative value */
    if (value2 < 0) {
        child.value = "";
        activateErrorModal('<p>U heeft een negatieve waarde ingevoerd. Er worden enkel positieve waarden toegelaten.</p>');
        return;
    }

    /* check if there is filled an integer values*/
    if (value2 != "" && value2 != parseInt(value2)) {
        child.value = "";
        activateErrorModal('<p>U mag enkel gehele getallen opgeven </p>');
        return;
    }

}

function saveChildInfo(childRow){
    var child = childRow.childNodes;
    var key = childRow.id;
    var name = child[0].getElementsByTagName("input")[0].value;
    var tarief = child[1].getElementsByTagName("input")[0].value;
    var days = child[2].getElementsByTagName("input")[0].value;
    var amount = child[3].getElementsByTagName("input")[0].value;
    var checked = child[4].getElementsByTagName("input")[0].checked;
    childrenInfo[key] = [name, tarief, days, amount, checked];
}

/* loops over al the sections and subsection and calls functions or create items that belong to that section/subsection */
function getFields (set, indentLvl, infoCode){
    var content = $('#content');
    /* new code when we enter a new level */
    var newInfoCode;
    var newContent;
    var infoButton;

    /* loop over al the elements that we have to display */
    for (var key in set) {
        newInfoCode = infoCode;
        newContent = '<div class="fieldRows indent'+ indentLvl + '">';
        infoButton = false;

        /* before lvl 2 indent tax on web use codes like _A_1 after that they use codes like _A_1_C2 */
        if(indentLvl < 2 && set[key] != 0)
            newInfoCode += "_" + key.charAt(0);
        else
            newInfoCode += key.charAt(0);

        /* check if there is a next level */
        if(isNaN(set[key])) {

            /* check if we need to display a info button */
            if (infoIconCodes.indexOf(newInfoCode) > -1) {
                infoButton = true;
                newContent += '<button type="button" class="field-info-button btn btn-primary btn-xs btn-round" onclick="window.open(\''+ infoURL + newInfoCode +'\',\'\', \'width=700, height=500\');"><span class="glyphicon glyphicon-info-sign"></span></button>';
            }

            /* when the ident level is 0 the title has to be bold */
            if(indentLvl == 0) {
                /* if there is a infoButton we don't need the margin of the title class */
                if(infoButton)
                    newContent += '<label class="indent' + indentLvl + '">' + key + '</label>';
                else
                    newContent += '<label class="indent' + indentLvl + ' title">' + key + '</label>';
            }else {
                if(infoButton)
                    newContent += '<p>' + key + '</p>';
                else
                    newContent += '<p class="title">' + key + '</p>';
            }

            newContent += '</div>';
            content.append(newContent);

            /* process next level */
            getFields(set[key], indentLvl + 1, newInfoCode);
        }else {
            /* check for section C, section C has a special layout */
            if(set[key] == 0)
                UI.Content.setSectionC(key, indentLvl, infoCode);
            else
            /* add a row with title, code and field */
                UI.Content.addField(key, set[key], indentLvl, newInfoCode);
        }
    }
}

/* add an extra input field for a specific code */
function addField (code) {
    var row;
    var number;
    var rowId;
    var id = code + '-';

    if(code in numberOfExtraFields){
        number = numberOfExtraFields[code] + 1;
        numberOfExtraFields[code] += 1;
    }else {
        number = 1;
        numberOfExtraFields[code] = 1;
    }
    id += number;
    rowId = 'row'+code + '-' + (number-1);
    row = $('#' + rowId);
    $('<div class="fieldRows" id="row'+id+'">' +
        '<p class="field-label indent"></p>' +
        '<label class="field-code">' + code + '</label>' +
        '<input type="text" id="'+id+'" class="field-input form-control" oninput="saveFieldValue( this.id, this.value); testOnPositiveDouble(this)" value=""></div>').insertAfter(row);

}

/* Set fields that you already filled in before you skipped the rest to complete later */
function setAddedFields(code){
    if(code in numberOfExtraFields){

        var content = "";
        var numberOfFields = numberOfExtraFields[code];
        for(var i = 1; i <= numberOfFields ; i++){
            var row = $('#row' + code + '-' + (i-1));
            var inputFieldId = code + '-' + i;
            content = '<div class="fieldRows" id="row'+inputFieldId+'">' +
                '<p class="field-label indent"></p>' +
                '<label class="field-code">' + code + '</label>';

            if(inputFieldId in fieldValues) {
                content += '<input type="text" id="'+inputFieldId+'" class="field-input form-control" oninput="saveFieldValue( this.id, this.value); testOnPositiveDouble(this)" value="' + fieldValues[inputFieldId] + '">';
            }else{
                content += '<input type="text" id="'+inputFieldId+'" class="field-input form-control" oninput="saveFieldValue( this.id, this.value); testOnPositiveDouble(this)" value="">';
            }
            content += '</div>';

            $(content).insertAfter(row);
        }
    }
}

/* toggles the modal and set the right content (error message) */
function activateErrorModal(content){
    if (errorModalIsOpen) {
        return false;
    }

    errorModalIsOpen = true;

    var errorModal = $('#errorModal');
    var modalContent = $('.modal-body');
    modalContent.empty();
    modalContent.append(content);

    errorModal.on('hidden.bs.modal', function () {
        errorModalIsOpen = false;
    });

    errorModal.modal('toggle');
}

/* toggles the modal and set the right content (confirmation) */
function activateConfirmModal(content, title){
    if (confirmModalIsOpen) {
        return false;
    }

    confirmModalIsOpen = true;

    var confirmModal = $('#confirmModal');
    var confirmTitle = $('#confirm-title');
    var modalContent = $('.modal-body');
    confirmTitle.empty();
    confirmTitle.append(title);
    modalContent.empty();
    modalContent.append(content);

    confirmModal.on('hidden.bs.modal', function () {
        confirmModalIsOpen = false;
    });

    confirmModal.modal('toggle');
}

var errorModalIsOpen = false;
var confirmModalIsOpen = false;

function saveFieldValue(code, value){
    fieldValues[code] = value;
    Session.sync();
}

function saveSectionCValues(row) {
    var values = row.childNodes;
    var key = row.id;
    var selected = values[0].getElementsByTagName("select")[0];
    var flag = selected.options[selected.selectedIndex].value;
    var code = values[1].getElementsByTagName("input")[0].value;
    var amount = values[2].getElementsByTagName("input")[0].value;
    sectionCValues[key] = [flag, code, amount];
}

function clearAllSavedData(){
    /* id of inputfields with there value */
    fieldValues = {};
    /* list of codes and the number of extra fields */
    numberOfExtraFields = {};
    /* liest of of childrenValues for the wizard */
    childrenInfo = {};
    /* result of the daycarewizard */
    result = 0;
    /* saved sectionValues */
    sectionCValues = {};
    numberOfSectionValues = 1;
    numberOfChildren = 1;
}

function removeAllchildren(){
    activateConfirmModal('<p>Bent u zeker dat u alle kinderen wilt verwijderen?</p>', '<h4 class="modal-title">Kinderen verwijderen</h4>');
    $('#confirm-button').unbind('click');
    $('#confirm-button').on('click', function(e) {
        numberOfChildren = 1;
        childrenInfo = {};
        result = 0;
        $('#confirmModal').modal('hide');
        UI.setDayCareWizard();
    });
}
