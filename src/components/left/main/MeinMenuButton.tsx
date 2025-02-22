import type { FC } from '../../../lib/teact/teact';
import React, {
    memo, useEffect, useRef, useState, useMemo
} from '../../../lib/teact/teact';
import DropdownMenu from '../../ui/DropdownMenu';
import LeftSideMenuItems from './LeftSideMenuItems';
import buildClassName from '../../../util/buildClassName';
import useOldLang from '../../../hooks/useOldLang';
import Button from '../../ui/Button';
import { LeftColumnContent } from '../../../types';
import useAppLayout from '../../../hooks/useAppLayout';
import { APP_NAME, DEBUG, IS_BETA } from '../../../config';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';
import useFlag from '../../../hooks/useFlag';
import { IS_ELECTRON, IS_MAC_OS } from '../../../util/windowEnvironment';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';


import './MeinMenuButton.scss';
type OwnProps = {
    content: LeftColumnContent;
    shouldSkipTransition?: boolean;
    alwaysMenu?:boolean;
    onSelectSettings: NoneToVoidFunction;
    onSelectContacts: NoneToVoidFunction;
    onSelectArchived: NoneToVoidFunction;
    onReset: NoneToVoidFunction;
};


const MeinMenuButton: FC<OwnProps> = ({
    content,
    shouldSkipTransition,
    alwaysMenu = false,
    onSelectSettings,
    onSelectContacts,
    onSelectArchived,
    onReset
}) => {
    const oldLang = useOldLang();
    const hasMenu =alwaysMenu || (content === LeftColumnContent.ChatList);
    const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

    // Disable dropdown menu RTL animation for resize
    const {
        shouldDisableDropdownMenuTransitionRef,
        handleDropdownMenuTransitionEnd,
    } = useLeftHeaderButtonRtlForumTransition(false);

    const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
    const isFullscreen = useFullscreenStatus();
    const { isMobile } = useAppLayout();

    const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {      
        return ({ onTrigger, isOpen }) => (
            <Button
                round
                ripple={hasMenu && !isMobile}
                size="smaller"
                color="translucent"
                className={isOpen ? 'active' : ''}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={hasMenu ? onTrigger : () => onReset()}
                ariaLabel={hasMenu ? oldLang('AccDescrOpenMenu2') : 'Return to chat list'}
            >
                <div className={buildClassName(
                    'animated-menu-icon',
                    !hasMenu && 'state-back',
                    shouldSkipTransition && 'no-animation',
                )}
                />
            </Button>
        );
    }, [hasMenu, isMobile, oldLang, onReset, shouldSkipTransition]);


    return (
        <div id="MeinMenuButton">
            {oldLang.isRtl && <div className="DropdownMenuFiller" />}
            <DropdownMenu
                trigger={MainButton}
                footer={`${APP_NAME} ${versionString}`}
                className={buildClassName(
                    'main-menu',
                    oldLang.isRtl && 'rtl',
                    shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
                )}
                forceOpen={isBotMenuOpen}
                positionX={'left'}
                transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
                onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
            >
                <LeftSideMenuItems
                    onSelectArchived={onSelectArchived}
                    onSelectContacts={onSelectContacts}
                    onSelectSettings={onSelectSettings}
                    onBotMenuOpened={markBotMenuOpen}
                    onBotMenuClosed={unmarkBotMenuOpen}
                />
            </DropdownMenu>            
        </div>

    )

}

export default memo(MeinMenuButton);
