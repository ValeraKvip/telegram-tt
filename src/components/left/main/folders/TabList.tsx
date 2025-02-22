import { ApiChatFolder } from '../../../../api/types';
import useColorFilter from '../../../../hooks/stickers/useColorFilter';
import useOldLang from '../../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import type { FC, TeactNode } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
  useState,
} from '../../../../lib/teact/teact';
import animateHorizontalScroll from '../../../../util/animateHorizontalScroll';
import buildClassName from '../../../../util/buildClassName';
import { extractCurrentThemeParams } from '../../../../util/themeStyle';
import { IS_ANDROID, IS_IOS } from '../../../../util/windowEnvironment';
import { MenuItemContextAction } from '../../../ui/ListItem';

import Tab from './Tab';

import './TabList.scss';

export type TabWithProperties = {
  id?: number;
  title: TeactNode;
  emoticon: string;
  badgeCount?: number;
  isBlocked?: boolean;
  isBadgeActive?: boolean;
  contextActions?: MenuItemContextAction[];
  folder: ApiChatFolder
};

type OwnProps = {
  tabs: readonly TabWithProperties[];
  activeTab: number;
  className?: string;
  tabClassName?: string;
  onSwitchTab: (index: number) => void;
  contextRootElementSelector?: string;
};

const TAB_SCROLL_THRESHOLD_PX = 16;
// Should match duration from `--slide-transition` CSS variable
const SCROLL_DURATION = IS_IOS ? 450 : IS_ANDROID ? 400 : 300;

const TabList: FC<OwnProps> = ({
  tabs,
  activeTab,
  onSwitchTab,
  contextRootElementSelector,
  className,
  tabClassName,

}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveTab = usePreviousDeprecated(activeTab);
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);

 
  const [colorFilter, setColorFilter] = useState('');
  useEffect(() => {
    const theme = extractCurrentThemeParams();   
    setColorFilter(useColorFilter(theme.button_color) || '');
  }, [])

  useEffect(() => {
    const container = containerRef.current!;
    const { scrollWidth, offsetWidth, scrollLeft } = container;
    if (scrollWidth <= offsetWidth) {
      return;
    }

    const activeTabElement = container.childNodes[activeTab] as HTMLElement | null;
    if (!activeTabElement) {
      return;
    }

    const { offsetLeft: activeTabOffsetLeft, offsetWidth: activeTabOffsetWidth } = activeTabElement;
    const newLeft = activeTabOffsetLeft - (offsetWidth / 2) + (activeTabOffsetWidth / 2);

    // Prevent scrolling by only a couple of pixels, which doesn't look smooth
    if (Math.abs(newLeft - scrollLeft) < TAB_SCROLL_THRESHOLD_PX) {
      return;
    }

    animateHorizontalScroll(container, newLeft, SCROLL_DURATION);
  }, [activeTab]);

  const lang = useOldLang();

  return (
    <div
      className={buildClassName('FolderTabList', 'custom-scroll', className)}
      ref={containerRef}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <div>
        {tabs.map((tab, i) => (
          <Tab
            key={tab.id}
            title={tab.title}
            emoticon={tab.emoticon}
            isActive={i === activeTab}
            isBlocked={tab.isBlocked}
            badgeCount={tab.badgeCount}
            isBadgeActive={tab.isBadgeActive}
            previousActiveTab={previousActiveTab}
            folder={tab.folder}
            onClick={onSwitchTab}
            clickArg={i}
            contextActions={tab.contextActions}
            contextRootElementSelector={contextRootElementSelector}
            className={tabClassName}
            sharedCanvasRef={sharedCanvasRef}
            activeColorFilter={colorFilter}
          />
        ))}
      </div>
      <canvas id="FolderSharedCanvas" ref={sharedCanvasRef} className="shared-canvas" style={`height:${tabs.length*80}px;`} />
    </div>
  );
};

export default memo(TabList);
