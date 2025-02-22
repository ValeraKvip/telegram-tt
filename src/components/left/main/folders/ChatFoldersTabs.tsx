import { ALL_FOLDER_ID } from '../../../../config';
import { getActions, getGlobal, withGlobal } from '../../../../global';
import { FolderEditDispatch } from '../../../../hooks/reducers/useFoldersReducer';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';
import type { FC } from '../../../../lib/teact/teact';
import React, {
    memo, useEffect, useRef, useState, useMemo
} from '../../../../lib/teact/teact';
import { MenuItemContextAction } from '../../../ui/ListItem';

import { selectCanShareFolder, selectTabState } from '../../../../global/selectors';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import { useFolderManagerForUnreadCounters } from '../../../../hooks/useFolderManager';
import type { ApiChatFolder, ApiChatlistExportedInvite, ApiSession } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import TabList, { TabWithProperties } from './TabList';

type OwnProps = {
    foldersDispatch: FolderEditDispatch;
    onReset: () => void;
};

type StateProps = {
    chatFoldersById: Record<number, ApiChatFolder>;
    folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
    orderedFolderIds?: number[];
    activeChatFolder: number;
    currentUserId?: string;
    shouldSkipHistoryAnimations?: boolean;
    maxFolders: number;
    maxChatLists: number;
    maxFolderInvites: number;
    hasArchivedChats?: boolean;
    hasArchivedStories?: boolean;
    archiveSettings: GlobalState['archiveSettings'];
    isStoryRibbonShown?: boolean;
    sessions?: Record<string, ApiSession>;
  
};


const ChatFoldersTabs: FC<OwnProps & StateProps> = ({

    foldersDispatch,
   
    chatFoldersById,
    orderedFolderIds,
    activeChatFolder,
    currentUserId,
    
    shouldSkipHistoryAnimations,
    maxFolders,
    maxChatLists,
  
    folderInvitesById,
    maxFolderInvites,
    hasArchivedChats,
    hasArchivedStories,
    archiveSettings,
    isStoryRibbonShown,
    sessions,
    onReset

}) => {

    const {        
        setActiveChatFolder,
        openChat,
        openShareChatFolderModal,
        openDeleteChatFolderModal,
        openEditChatFolder,
        openLimitReachedModal,
    } = getActions();

    const lang = useLang();

    const {
        ref: placeholderRef,
        shouldRender: shouldRenderPlaceholder,
    } = useShowTransition({
        isOpen: !orderedFolderIds,
        noMountTransition: true,
        withShouldRender: true,
    });

    const folderCountersById = useFolderManagerForUnreadCounters();
      const allChatsFolder: ApiChatFolder = useMemo(() => {
        return {
          id: ALL_FOLDER_ID,
         // title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
          title: { text:  lang('FilterAllChats') },
          includedChatIds: MEMO_EMPTY_ARRAY,
          excludedChatIds: MEMO_EMPTY_ARRAY,
        } satisfies ApiChatFolder;
      }, [orderedFolderIds, lang]);

    const displayedFolders = useMemo(() => {
        return orderedFolderIds
            ? orderedFolderIds.map((id) => {
                if (id === ALL_FOLDER_ID) {
                    return allChatsFolder;
                }

                return chatFoldersById[id] || {};
            }).filter(Boolean)
            : undefined;
    }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

    const folderTabs = useMemo(() => {
        if (!displayedFolders || !displayedFolders.length) {
            return undefined;
        }

        return displayedFolders.map((folder, i) => {
          
            const { id, title } = folder;
            const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
            const canShareFolder = selectCanShareFolder(getGlobal(), id);
            const contextActions: MenuItemContextAction[] = [];

            if (canShareFolder) {
                contextActions.push({
                    title: lang('FilterShare'),
                    icon: 'link',
                    handler: () => {
                        const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
                        if (chatListCount >= maxChatLists && !folder.isChatList) {
                            openLimitReachedModal({
                                limit: 'chatlistJoined',
                            });
                            return;
                        }

                        // Greater amount can be after premium downgrade
                        if (folderInvitesById[id]?.length >= maxFolderInvites) {
                            openLimitReachedModal({
                                limit: 'chatlistInvites',
                            });
                            return;
                        }

                        openShareChatFolderModal({
                            folderId: id,
                        });
                    },
                });
            }

            if (id !== ALL_FOLDER_ID) {
                contextActions.push({
                    title: lang('FilterEdit'),
                    icon: 'edit',
                    handler: () => {
                        openEditChatFolder({ folderId: id });
                    },
                });

                contextActions.push({
                    title: lang('FilterDelete'),
                    icon: 'delete',
                    destructive: true,
                    handler: () => {
                        openDeleteChatFolderModal({ folderId: id });
                    },
                });
            }
           
            return {
                id,
                title: renderTextWithEntities({
                    text: title.text,
                    entities: title.entities,
                    noCustomEmojiPlayback: folder.noTitleAnimations,
                }),
                emoticon:folder.emoticon || '',
                badgeCount: folderCountersById[id]?.chatsCount,
                isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
                isBlocked,
                contextActions: contextActions?.length ? contextActions : undefined,
                folder,               
            } satisfies TabWithProperties;
        });
    }, [
        displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
        maxFolderInvites,
    ]);

    const handleSwitchTab = useLastCallback((index: number) => {        
        onReset();
        setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
    });

    const shouldRenderFolders = folderTabs && folderTabs.length > 1;

    return (
        <>       
            {shouldRenderFolders ? (
                <TabList
                    contextRootElementSelector="#LeftColumn"
                    tabs={folderTabs}
                    activeTab={activeChatFolder}
                    onSwitchTab={handleSwitchTab}                  
                />
            ) : shouldRenderPlaceholder ? (
                <div ref={placeholderRef} className="tabs-placeholder" />
            ) : undefined}
        </>
    )
}



export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        const {
            chatFolders: {
                byId: chatFoldersById,
                orderedIds: orderedFolderIds,
                invites: folderInvitesById,
            },
            chats: {
                listIds: {
                    archived,
                },
            },
            stories: {
                orderedPeerIds: {
                    archived: archivedStories,
                },
            },
            activeSessions: {
                byHash: sessions,
            },
            currentUserId,
            archiveSettings,
        } = global;
        const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);
        const { storyViewer: { isRibbonShown: isStoryRibbonShown } } = selectTabState(global);

        return {
            chatFoldersById,
            folderInvitesById,
            orderedFolderIds,
            activeChatFolder,
            currentUserId,
            shouldSkipHistoryAnimations,
            hasArchivedChats: Boolean(archived?.length),
            hasArchivedStories: Boolean(archivedStories?.length),
            maxFolders: selectCurrentLimit(global, 'dialogFilters'),
            maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
            maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
            archiveSettings,
            isStoryRibbonShown,
            sessions,
        };
    },
)(ChatFoldersTabs));