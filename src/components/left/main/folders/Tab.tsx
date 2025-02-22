import { ApiChatFolder } from '../../../../api/types';
import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../../../hooks/useFastClick';
import useLastCallback from '../../../../hooks/useLastCallback';
import type { FC, TeactNode } from '../../../../lib/teact/teact';
import React, {
  useEffect, useRef, useState,
  useLayoutEffect
} from '../../../../lib/teact/teact';
import buildClassName from '../../../../util/buildClassName';

import { MouseButton } from '../../../../util/windowEnvironment';
import renderText from '../../../common/helpers/renderText';
import Icon from '../../../common/icons/Icon';
import { MenuItemContextAction } from '../../../ui/ListItem';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';
import MenuSeparator from '../../../ui/MenuSeparator';
import FolderEmoji from './FolderEmoji';



import './Tab.scss';

type OwnProps = {
  className?: string;
  title: TeactNode;
  emoticon: string,
  isActive?: boolean;
  activeColorFilter?:string;
  isBlocked?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  previousActiveTab?: number;
  folder: ApiChatFolder
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
};

const classNames = {
  active: 'FolderTab--active',
  badgeActive: 'FolderTab__badge--active',
};

const Tab: FC<OwnProps> = ({
  className,
  title,
  isActive,
  isBlocked,
  badgeCount,
  isBadgeActive,
  previousActiveTab,
  folder,
  onClick,
  clickArg,
  contextActions,
  contextRootElementSelector,
  sharedCanvasRef,
  activeColorFilter
}) => {
  // eslint-disable-next-line no-null/no-null
  const [customEmojiPlay, setCustomEmojiPlay] = useState(1);
  const tabRef = useRef<HTMLDivElement>(null);
  const customEmojiRef = useRef<HTMLDivElement>(null);


  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(tabRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {    
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => tabRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? tabRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));




  return (
    <div
      className={buildClassName('FolderTab', onClick && 'Tab--interactive', className, isActive && classNames.active)}
      onClick={handleClick}     
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={tabRef}
    >     
      <div className="icon-wrapper">
        <FolderEmoji
          folder={folder}
          sharedCanvasRef={sharedCanvasRef}
          isActive={isActive}
          activeColorFilter={activeColorFilter}        
        />

        {Boolean(badgeCount) && (
          <span className={buildClassName('badge', isBadgeActive && classNames.badgeActive)}>{badgeCount}</span>
        )}
      </div>

      <span className='folder-name'>
        {typeof title === 'string' ? renderText(title) : title}
      </span>

      {isBlocked && <Icon name="lock-badge" className="blocked" />}     

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Tab-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default Tab;
