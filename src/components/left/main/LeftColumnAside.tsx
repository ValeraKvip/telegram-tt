import type { FC } from '../../../lib/teact/teact';
import React, {
    memo
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';
import { LeftColumnContent, SettingsScreens } from '../../../types';
import MeinMenuButton from './MeinMenuButton';
import useLastCallback from '../../../hooks/useLastCallback';

import './LeftColumnAside.scss';
import { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import ChatFoldersTabs from './folders/ChatFoldersTabs';

type OwnProps = {
    content: LeftColumnContent;
    isForumPanelOpen?: boolean;
    onReset: (full?:true | Event) => void;
    onContentChange: (content: LeftColumnContent) => void;
    onSettingsScreenSelect: (screen: SettingsScreens) => void;
    foldersDispatch: FolderEditDispatch;
};


const LeftColumnAside: FC<OwnProps> = ({
    content,
    isForumPanelOpen,
    onReset,
    onContentChange,
    onSettingsScreenSelect,
    foldersDispatch
}) => {
    const { closeForumPanel } = getActions();
    const handleSelectSettings = useLastCallback(() => {
        onContentChange(LeftColumnContent.Settings);
    });

    const handleSelectContacts = useLastCallback(() => {
        onContentChange(LeftColumnContent.Contacts);
    });

    const handleSelectArchived = useLastCallback(() => {
        onContentChange(LeftColumnContent.Archived);
        closeForumPanel();
    });

    return (
        <div id="LeftColumnAside" className='component-theme-dark'>
            <MeinMenuButton
                content={content}
                onReset={()=>onReset()}
                alwaysMenu={true}
                onSelectSettings={handleSelectSettings}
                onSelectContacts={handleSelectContacts}
                onSelectArchived={handleSelectArchived}
            />
            <ChatFoldersTabs
                foldersDispatch={foldersDispatch}
                onReset={()=>onReset(true)}
            />
        </div>
    )
}

export default memo(LeftColumnAside);
