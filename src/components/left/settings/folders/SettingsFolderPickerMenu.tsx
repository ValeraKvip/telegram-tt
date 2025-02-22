import React, {
  memo, useCallback,
} from '../../../../lib/teact/teact';

export type OwnProps = {
  isOpen: boolean;
 
  observeIntersection: ObserveFn;
  onSelectEmoji: (emojiStatus: ApiSticker | string) => void;
  onClose: () => void;
};
import { FC } from '../../../../lib/teact/teact';
import { ApiSticker } from '../../../../api/types';
import {  withGlobal } from '../../../../global';
import useFlag from '../../../../hooks/useFlag';
import Portal from '../../../ui/Portal';
import { selectIsContextMenuTranslucent } from '../../../../global/selectors';
import Menu from '../../../ui/Menu';

import styles from './SettingsFolderPickerMenu.module.scss'
import FolderEmojiPicker from './FolderEmojiPicker';
import { ObserveFn } from '../../../../hooks/useIntersectionObserver';
interface StateProps { 
  isTranslucent?: boolean;
  
}

const SettingsFoldersEmoticonPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  isTranslucent,
  onSelectEmoji,
  onClose,
   observeIntersection,
}) => {

  const [isContextMenuShown, markContextMenuShown, unmarkContextMenuShown] = useFlag();

  const handleEmojiSelect = useCallback((sticker: ApiSticker|string) => {   
    onSelectEmoji(sticker);
    onClose();
  }, [onClose, onSelectEmoji]);


  return (
    <Portal>
      <Menu    
        isOpen={isOpen}
        noCompact
        bubbleClassName={styles.menuContent}
        onClose={onClose}                     
        noCloseOnBackdrop={isContextMenuShown}       
      >
        <FolderEmojiPicker
          idPrefix="folders-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}         
          observeIntersection={observeIntersection}                   
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onCustomEmojiSelect={handleEmojiSelect}
          onContextMenuClick={onClose}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {    
    isTranslucent: selectIsContextMenuTranslucent(global),
  };
})(SettingsFoldersEmoticonPicker));
