import { FC, RefObject, useCallback, useEffect, useRef, useState } from "../../../../lib/teact/teact";
import { getCaretPosition, setCaretPosition } from "../../../../util/selection";

const STACK_SIZE = 40;

type State = {
    text: string;
    caretPosition: number;
}

//That's a shame! However, the properly designed undo system is  half-done and commented on below.
export default function useUndoRed(
    inputRef: RefObject<HTMLDivElement | null>,
    onUpdate: (html: string) => void,
    getHtml: () => string,
    getNewInput: () => { text: string }

) {

    const skipNextUpdate = useRef(false);
    const [history, setHistory] = useState<State[]>([{
        text: '',
        caretPosition: 0
    }]);

    const historyRef = useRef(history);

    const [caretPos, setCaretPos] = useState<number>(0);
    const caretPosRef = useRef(caretPos);


    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    const handleKeyDown = (event: KeyboardEvent) => {
        if (!inputRef.current) {
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            undo()
        }
    };


    useEffect(() => {
        if (!inputRef.current) {
            return
        }
        inputRef.current.addEventListener('keydown', handleKeyDown);

        return () => {
            inputRef.current?.removeEventListener('keydown', handleKeyDown);
        };
    }, [inputRef.current]);



    useEffect(() => {
        if (skipNextUpdate.current) {
            skipNextUpdate.current = false;
            return;
        }
        addState(getHtml());
    }, [getHtml])



    const addState = (text: string) => {
        if (history.length >= STACK_SIZE) {
            history.shift();
        }
        const pos = inputRef.current ? getCaretPosition(inputRef.current) : 0;
        setCaretPos(pos);
        setHistory([...history, {
            text,
            caretPosition: pos
        }]);
    }

    const undo = useCallback(() => {

        const current = historyRef.current.pop();

        if (!historyRef.current.length || !current) {
            setCaretPos(0);
            onUpdate('');
            return;
        }
        skipNextUpdate.current = true;
        const state = historyRef.current[historyRef.current.length - 1];

        setHistory(historyRef.current);

        const { text, caretPosition } = state;

        if (inputRef.current) {
            setCaretPos(caretPosition);

        }
        onUpdate(text);



        // return state;
    }, [])

    const reset = () => {
        setCaretPos(0);
        setHistory([]);
    }

    return { addState, reset, caretPos };
}



//TODO once. Undo system that is based on storing state changes instead of storing the entire state.
/**
import useFlag from "../../../../hooks/useFlag";
import useLastCallback from "../../../../hooks/useLastCallback";
import { FC, memo, RefObject, useCallback, useEffect, useRef, useState } from "../../../../lib/teact/teact";
import { getCaretPosition, setCaretPosition } from "../../../../util/selection";

const STACK_SIZE = 50;

const ACTION_ADD = 1;
const ACTION_REMOVE = 2;
const ACTION_REPLACE = 3;

type StateAdd = {
    action: typeof ACTION_ADD;
    text: string;
    caretPosition: number;
    start: number,
    end: number
}

type StateRemove = {
    action: typeof ACTION_REMOVE;
    text: string;
    caretPosition: number;
    start: number,
    end: number
}

type StateReplace = {
    action: typeof ACTION_REPLACE;
    text: string;
    rangeStart: number;
    rangeEnd: number;
    start: number,
    end: number
}
type State = StateAdd | StateRemove | StateReplace

type SelectionRange = {
    start: number;
    end: number;
}


type Action = typeof ACTION_ADD | typeof ACTION_REMOVE | typeof ACTION_REPLACE;

export default function useUndoRed(
    inputRef: RefObject<HTMLDivElement | null>,
    onUpdate: (html: string) => void,
    getHtml: () => string,
    getNewInput: () => { text: string }

) {
    const [history, setHistory] = useState<State[]>([]);
    const [prevState, setPrevState] = useState<string>('');
    const prevStateRef = useRef(prevState);
    const x = useRef(1);
    const skipNextUpdate = useRef(false);
    const historyRef = useRef(history);

    const [caretPos, setCaretPos] = useState<number>(0);
    const caretPosRef = useRef(caretPos);


    const prevString = useRef('');

    const currentSelection = useRef<SelectionRange>({
        start: 0,
        end: 0
    });
    const previousSelection = useRef<SelectionRange>({
        start: 0,
        end: 0
    });
    const [selection, setSelection] = useState<Selection | null>(null);

    const handleSelectionChange = () => {
        const selection = window.getSelection();
        x.current = x.current + 1;
        previousSelection.current = currentSelection.current;

        if (selection && selection.rangeCount > 0) {
            const range = selection?.getRangeAt(0).cloneRange();
            currentSelection.current = {
                start: range.startOffset,
                end: range.endOffset
            }
        } else {
            currentSelection.current = {
                start: 0,
                end: 0
            }
        }
    };


    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, []);


    // useEffect(() => {
    //     const { text } = getNewInput();
    //     addState(text);
    // }, [getNewInput])

    useEffect(() => {
        historyRef.current = history;
    }, [history]);



    useEffect(() => {
        const html = getHtml();
        if (skipNextUpdate.current) {
            skipNextUpdate.current = false;
            prevString.current = html;
            return;
        }

        const original = prevString.current;
        const selectionSize =  previousSelection.current.end - previousSelection.current.start;
        const { start, end } = findModificationIndices(original, html,selectionSize);
        if (end === -1 || start === -1) {
            addState(html, 0, html.length, selectionSize > 0?ACTION_REPLACE:ACTION_ADD);
        } else {
            addState(html.substring(start, end), start, end, selectionSize > 0?ACTION_REPLACE:(html.length >= original.length ? ACTION_ADD:ACTION_REMOVE));
        }


        prevString.current = html;

    }, [getHtml])

    const handleKeyDown = (event: KeyboardEvent) => {

        if (!inputRef.current) {
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            undo()
        }
    };


    useEffect(() => {
        if (!inputRef.current) {
            return
        }
        inputRef.current.addEventListener('keydown', handleKeyDown);
        return () => {
            inputRef.current?.removeEventListener('keydown', handleKeyDown);
        };
    }, [inputRef.current]);




    const addState = (text: string, start: number, end: number, action: Action) => {
        if (history.length >= STACK_SIZE) {
            history.shift();
        }

        const prevPos = caretPos;
        const pos = inputRef.current ? getCaretPosition(inputRef.current) : 0;
        if (action == ACTION_ADD) {
            setCaretPos(pos);
            setHistory([...history, {
                action: ACTION_ADD,
                text,
                start,
                end,
                caretPosition: prevPos
            }]);
        } else if (action === ACTION_REMOVE) {
            const { start, end } = previousSelection.current
            setCaretPos(pos);
            setHistory([...history, {
                action: ACTION_REMOVE,
                text: prevState[pos],
                caretPosition: prevPos,
                start,
                end,
            }]);

        } else {
            setCaretPos(pos);
            setHistory([...history, {
                action: ACTION_REPLACE,
                text: prevState.substring(start, end),
                rangeStart: start,
                rangeEnd: end,
                start,
                end,
            }]);

        }

        setPrevState(getHtml());
    }

    const undo = useCallback(() => {

        const current = historyRef.current.pop();
        if (!current) {
            setCaretPos(0);
            onUpdate('');
            return;
        }
        skipNextUpdate.current = true;
        const state = historyRef.current[historyRef.current.length - 1];


        const html = getHtml();
        const result = html.slice(0, current.start) + current.text + html.slice(current.end);

        onUpdate(result);
        setCaretPos(current.start);
        switch (current.action) {
            case ACTION_ADD: {
                const html = getHtml();
                const result = html.slice(0, current.start) + html.slice(current.end);
                onUpdate(result);
                setCaretPos(current.caretPosition);

                break;
            }

            case ACTION_REMOVE: {
                const html = getHtml();
                const result = html.slice(0, current.start) + current.text + html.slice(current.end);
                onUpdate(result);
                setCaretPos(current.caretPosition);
                break;
            }

            case ACTION_REPLACE: {
                const html = getHtml();
                const result = html.slice(0, current.start) + current.text + html.slice(current.end);
                onUpdate(result);
                setCaretPos(current.rangeEnd);
                //TODO select?
                break;
            }
        }
    }, [])

    const reset = () => {
        setCaretPos(0);
        setHistory([]);
    }

    return { addState, reset, caretPos, };
}

function findModificationIndices(original: string, modified: string, selectionSize: number) {
    let start = -1;
    let end = -1;


    for (let i = 0; i < Math.min(original.length, modified.length); i++) {
        if (original[i] !== modified[i]) {
            start = i;
            break;
        }
    }


    if (start === -1) {
        if (modified.length > original.length) {
            return { start: original.length, end: modified.length }
        }
        return { start: -1, end: -1 };
    }

    if (start === 0) {
        return {
            start,
            end: modified.length
        }
    }


    if (modified.length > original.length) {
        end = start + (modified.length - (original.length - selectionSize));
    } else {
        end = start + (original.length - modified.length);
    }

    return { start, end };
}

**/


