import { ApiChatFolder } from '../../../../api/types/chats';
import { ApiStickerSet } from '../../../../api/types/messages';
import { ALL_FOLDER_ID, BASE_URL, EMOJI_SIZE_PICKER, IS_PACKAGED_ELECTRON } from '../../../../config';
import { withGlobal } from '../../../../global';
import React, { memo } from '../../../../lib/teact/teact';
import type { FC, TeactNode } from '../../../../lib/teact/teact';
import buildStyle from '../../../../util/buildStyle';
import { nativeToUnified } from '../../../../util/emoji/emoji';
import CustomEmoji from '../../../common/CustomEmoji';
import { FOLDER_ICONS_SET_ID } from '../../../common/icons/FolderIcons';

import './FolderEmoji.scss';

type OwnProps = {
    folder: ApiChatFolder & { customEmoji?: string };   
    isActive?: boolean;
    activeColorFilter?: string;
    sharedCanvasRef?: React.RefObject<HTMLCanvasElement>
};

type StateProps = {
    customEmoji?: string;
    folderSet: ApiStickerSet
};

const FolderEmoji: FC<OwnProps & StateProps> = ({
    folder,
    folderSet,
    isActive,
    sharedCanvasRef,
    customEmoji,
    activeColorFilter,

}) => {


    const renderEmoji = () => {
        let index = -1;
        if (folder.id === ALL_FOLDER_ID) {
            index = 0
        }
        else if (!customEmoji && !folder.emoticon) {
            index = folderSet.stickers!.length - 1;
        }
        else {
            index = folderSet.stickers?.findIndex(sticker => sticker.id === customEmoji) ?? -1;
        }

        if (index !== -1) {
            const sticker = folderSet.stickers![index];
            return (
                <img
                    src={sticker.thumbnail?.dataUri}
                    alt={folder.emoticon}
                    loading="lazy"
                    draggable={false}
                    style={buildStyle(
                        isActive && activeColorFilter
                    )}
                />
            )
        }

        if (Boolean(customEmoji)) {
            if (isDocumentIdNotEmoticon(customEmoji)) {
                return (

                    <CustomEmoji
                        documentId={customEmoji}
                        size={EMOJI_SIZE_PICKER}
                        noPlay={false}
                        sharedCanvasRef={sharedCanvasRef}
                        withTranslucentThumb
                        forceAlways={false}
                    />
                )
            } else {
                const image = nativeToUnified(customEmoji);
                const src = `${IS_PACKAGED_ELECTRON ? BASE_URL : '.'}/img-apple-64/${image}.png`;

                return (
                    <img
                        src={src}
                        alt={folder.emoticon}
                        loading="lazy"
                        data-path={src}
                        draggable={false}
                        className='static-emoji'
                    />
                )
            }
        }
    }

    return (
        <div className='FolderEmoji'>
            {renderEmoji()}
        </div>
    )
}

function isDocumentIdNotEmoticon(str: string) {
    return str.length && /^\d$/.test(str.charAt(0));
}

export default memo(withGlobal<OwnProps>(
    (global, { folder }): StateProps => {
        const {
            folderCustomIcons,
            stickers: {
                setsById: setsById
            }
        } = global;

        const customEmoji = folder.customEmoji || folderCustomIcons?.[folder.id];
        const folderSet = setsById[FOLDER_ICONS_SET_ID];

        return {
            customEmoji,
            folderSet
        };
    },
)(FolderEmoji));