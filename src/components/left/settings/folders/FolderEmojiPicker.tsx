import type { FC } from '../../../../lib/teact/teact';
import React, {
    memo, useEffect, useMemo, useRef,    
    useState,
} from '../../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../../global';

import type {
    ApiAvailableReaction, ApiReaction, ApiReactionWithPaid, ApiSticker, ApiStickerSet,
} from '../../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../../types';

import {
    BASE_EMOJI_KEYWORD_LANG,
    BASE_URL,
    FAVORITE_SYMBOL_SET_ID,
    IS_PACKAGED_ELECTRON,
    POPULAR_SYMBOL_SET_ID,
    RECENT_SYMBOL_SET_ID,
    SEARCH_SYMBOL_SET_ID,
    SLIDE_TRANSITION_DURATION,
    STICKER_PICKER_MAX_SHARED_COVERS,
    STICKER_SIZE_PICKER_HEADER,
    TOP_SYMBOL_SET_ID,
} from '../../../../config';

import {
    selectCanPlayAnimatedEmojis,
    selectChatFullInfo,
    selectIsAlwaysHighPriorityEmoji,
    selectIsChatWithSelf,
    selectIsCurrentUserPremium,
} from '../../../../global/selectors';
import animateHorizontalScroll from '../../../../util/animateHorizontalScroll';
import buildClassName from '../../../../util/buildClassName';
import { pickTruthy, unique, uniqueByField } from '../../../../util/iteratees';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';
import { REM } from '../../../common/helpers/mediaDimensions';

import useAppLayout from '../../../../hooks/useAppLayout';
import useHorizontalScroll from '../../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import useScrolledState from '../../../../hooks/useScrolledState';
import useAsyncRendering from '../../../right/hooks/useAsyncRendering';


import StickerSetCover from '../../../middle/composer/StickerSetCover';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import Icon from '../../../common/icons/Icon';

import StickerSet from '../../../common/StickerSet';

import pickerStyles from '../../../middle/composer/StickerPicker.module.scss';
import styles from './FolderEmojiPicker.module.scss';
import { FOLDER_ICONS_SET_ID } from '../../../common/icons/FolderIcons';
import SearchInput from '../../../ui/SearchInput';
import useFlag from '../../../../hooks/useFlag';
import StickerButton from '../../../common/StickerButton';
import { useStickerPickerObservers } from '../../../common/hooks/useStickerPickerObservers';
import usePrevDuringAnimation from '../../../../hooks/usePrevDuringAnimation';
import { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import FolderEmojiSet from './FolderEmojiSet';
import useEmojiTooltip from '../../../middle/composer/hooks/useEmojiTooltip';


type OwnProps = {
    chatId?: string;
    className?: string;
    pickerListClassName?: string;
    isHidden?: boolean;
    idPrefix?: string;
    withDefaultTopicIcons?: boolean;
    selectedReactionIds?: string[];
    loadAndPlay: boolean;
    observeIntersection: ObserveFn;
    onCustomEmojiSelect: (emoji: ApiSticker | string) => void;
    onReactionSelect?: (reaction: ApiReactionWithPaid) => void;
    onReactionContext?: (reaction: ApiReactionWithPaid) => void;
    onContextMenuOpen?: NoneToVoidFunction;
    onContextMenuClose?: NoneToVoidFunction;
    onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
    customEmojisById?: Record<string, ApiSticker>;
    recentCustomEmojiIds?: string[];
    recentStatusEmojis?: ApiSticker[];
    chatEmojiSetId?: string;
    topReactions?: ApiReaction[];
    recentReactions?: ApiReaction[];
    defaultTagReactions?: ApiReaction[];
    stickerSetsById: Record<string, ApiStickerSet>;
    availableReactions?: ApiAvailableReaction[];
    addedCustomEmojiIds?: string[];
    defaultTopicIconsId?: string;
    defaultStatusIconsId?: string;
    customEmojiFeaturedIds?: string[];
    canAnimate?: boolean;
    isSavedMessages?: boolean;
    isCurrentUserPremium?: boolean;
    isWithPaidReaction?: boolean;   
    emojiKeywords?: Record<string, string[]>;
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const DEFAULT_ID_PREFIX = 'custom-emoji-set';
const TOP_REACTIONS_COUNT = 16;
const RECENT_REACTIONS_COUNT = 32;
const RECENT_DEFAULT_STATUS_COUNT = 7;
const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
const STICKER_SET_IDS_WITH_COVER = new Set([
    RECENT_SYMBOL_SET_ID,
    FAVORITE_SYMBOL_SET_ID,
    POPULAR_SYMBOL_SET_ID,
]);

const FolderEmojiPicker: FC<OwnProps & StateProps> = ({
    customEmojisById,
    className,
    pickerListClassName,
    isHidden,
    addedCustomEmojiIds,
    loadAndPlay,
    selectedReactionIds,
    recentStatusEmojis,
    stickerSetsById,
    chatEmojiSetId,
    topReactions,
    recentReactions,
    availableReactions,
    idPrefix = DEFAULT_ID_PREFIX,
    customEmojiFeaturedIds,
    canAnimate,
    isSavedMessages,
    isCurrentUserPremium,
    withDefaultTopicIcons,
    defaultTopicIconsId,
    defaultStatusIconsId,
    defaultTagReactions,
    isWithPaidReaction,    
    emojiKeywords,
    observeIntersection,
    onCustomEmojiSelect,
    onReactionSelect,
    onReactionContext,
    onContextMenuOpen,
    onContextMenuClose,
    onContextMenuClick,
}) => {//defaultStatusIconsId=[]    
    // eslint-disable-next-line no-null/no-null
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line no-null/no-null
    const headerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line no-null/no-null
    const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
    // eslint-disable-next-line no-null/no-null
    const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

    const { isMobile } = useAppLayout();
    const {
        handleScroll: handleContentScroll,
        isAtBeginning: shouldHideTopBorder,
    } = useScrolledState();



    const prefix = `${idPrefix}-custom-emoji`;
    const {
        activeSetIndex,
        observeIntersectionForSet,
        observeIntersectionForPlayingItems,
        observeIntersectionForShowingItems,
        observeIntersectionForCovers,
        selectStickerSet,
    } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);
    const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

    const lang = useOldLang();

    const areAddedLoaded = Boolean(addedCustomEmojiIds);

    const folderSet = stickerSetsById[FOLDER_ICONS_SET_ID]!

    const allSets = useMemo(() => {
        const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

        const userSetIds = [...(addedCustomEmojiIds || [])];
        if (chatEmojiSetId) {
            userSetIds.unshift(chatEmojiSetId);
        }

        const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

        const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));


        return [
            ...defaultSets,
            ...setsToDisplay,
        ];
    }, [
        addedCustomEmojiIds, withDefaultTopicIcons,
        customEmojiFeaturedIds, stickerSetsById, topReactions, availableReactions, lang, recentReactions,
        defaultStatusIconsId, defaultTopicIconsId, isSavedMessages, defaultTagReactions, chatEmojiSetId,
        isWithPaidReaction,
    ]);

    const noPopulatedSets = useMemo(() => (
        areAddedLoaded
        && allSets.filter((set) => set.stickers?.length).length === 0
    ), [allSets, areAddedLoaded]);

    const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
    const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets;

    useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

    // Scroll container and header when active set changes
    useEffect(() => {
        if (!areAddedLoaded) {
            return;
        }

        const header = headerRef.current;
        if (!header) {
            return;
        }

        const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

        animateHorizontalScroll(header, newLeft);
    }, [areAddedLoaded, activeSetIndex]);

    const handleEmojiSelect = useLastCallback((emoji: ApiSticker | string) => {
        onCustomEmojiSelect(emoji);
    });

    function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
        index += 2;
        const buttonClassName = buildClassName(
            pickerStyles.stickerCover,
            (index) === activeSetIndex && styles.activated,
        );

        const firstSticker = stickerSet.stickers?.[0];


        const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
        const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

        if (stickerSet.id === TOP_SYMBOL_SET_ID) {
            return undefined;
        }

        if (STICKER_SET_IDS_WITH_COVER.has(stickerSet.id) || stickerSet.hasThumbnail || !firstSticker) {
            const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === POPULAR_SYMBOL_SET_ID;
            const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
            return (
                <Button
                    key={stickerSet.id}
                    className={buttonClassName}
                    ariaLabel={stickerSet.title}
                    round
                    faded={isFaded}
                    color="translucent"
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => selectStickerSet(index)}
                >
                    {isRecent ? (
                        <Icon name="recent" />
                    ) : (
                        <StickerSetCover
                            stickerSet={stickerSet as ApiStickerSet}
                            forcePlayback
                            noPlay={!canAnimate || !canLoadAndPlay}
                            observeIntersection={observeIntersectionForCovers}
                            sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
                        />
                    )}
                </Button>
            );
        }

        return (
            <StickerButton
                key={stickerSet.id}
                sticker={firstSticker}
                size={STICKER_SIZE_PICKER_HEADER}
                title={stickerSet.title}
                className={buttonClassName}
                observeIntersection={observeIntersectionForCovers}
                noContextMenu
                noPlay={!canAnimate || !canLoadAndPlay}
                isCurrentUserPremium
                sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
                onClick={() => selectStickerSet(index)}
                clickArg={index}
                forcePlayback
            />
        );
    }

    const fullClassName = buildClassName('Sticker--ofsetPicker', styles.root, className);

    if (!shouldRenderContent) {
        return (
            <div className={fullClassName}>
                {noPopulatedSets ? (
                    <div className={pickerStyles.pickerDisabled}>{lang('NoStickers')}</div>
                ) : (
                    <Loading />
                )}
            </div>
        );
    }

    const headerClassName = buildClassName(
        pickerStyles.header,
        'no-scrollbar',
        !shouldHideTopBorder && pickerStyles.headerWithBorder,
    );
    const listClassName = buildClassName(
        pickerStyles.main,
        pickerStyles.main_customEmoji,
        IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
        pickerListClassName,
        pickerStyles.hasHeader,
    );


    const [isLoading, setSearchLoadingStarted, setSearchLoadingFinished] = useFlag();
    const [searchResults, setSearchResults] = useState<ApiSticker[]>([]);
    /**
     * 
     *  SEARCH
     *  
     */

    const searchAsync = async (q: string) => {
        try {           
            if (!q || !customEmojisById) {
                setSearchResults([]);
                return;
            }
            setSearchLoadingStarted();
            const search = q.toLowerCase().replace(/_/g, ' ').trim();

            

            const keywords = emojiKeywords
            if (!keywords) {
                setSearchResults([]);
                return;
            }
            const keys = Object.keys(keywords);
            const filter = keys.filter(key => key.startsWith(search));

            let sets = Object.values(customEmojisById).filter(x =>
                filter.filter(keyword =>
                    keywords[keyword].filter(emoji => emoji === x.emoji).length > 0
                ).length > 0
            )
            Object.values(allSets).map(set => {
                const { packs } = set as ApiStickerSet;
                if (packs) {
                    return filter.map(keyword => {
                        return keywords[keyword].map(emoji => packs[emoji] || false).flat()
                    }).flat()
                }

                return null;
            }).flat().filter(Boolean)

            setSearchResults(uniqueByField(sets, 'id'));
            setSearchLoadingFinished();
        } catch (e) { }
    }


    const searchQuery = '';
    const isSearchFocused = false;
    return (
        <div className={fullClassName}>
            {/* COVER */}
            <div
                ref={headerRef}
                className={headerClassName}
            >
                <div className="shared-canvas-container">
                    <canvas ref={sharedCanvasRef} className="shared-canvas" />
                    <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
                    {/* FOLDER COVER */}
                    <Button
                        className={buildClassName(
                            pickerStyles.stickerCover,
                            0 === activeSetIndex && styles.activated,
                            pickerStyles.folderEmoji
                        )}
                        ariaLabel={"Folder emojis"}
                        round
                        faded={false}
                        color="translucent"
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => selectStickerSet(0)}
                    >
                        <img src={folderSet.stickers![7].thumbnail!.dataUri} alt="" />
                    </Button>
                    {/* EMOJIS COVER */}
                    <Button
                        className={buildClassName(
                            pickerStyles.stickerCover,
                            1 === activeSetIndex && styles.activated,
                            pickerStyles.folderEmoji
                        )}
                        ariaLabel={"Smileys & People"}
                        round
                        faded={false}
                        color="translucent"
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => selectStickerSet(1)}
                    >
                        <img src={`${IS_PACKAGED_ELECTRON ? BASE_URL : '.'}/img-apple-64/1f600.png`} alt="😀" loading="lazy" draggable="false"
                            style={`width:32px; height:32px;`} />
                    </Button>

                    {/* CUSTOM EMOJIS COVER */}
                    {allSets.map(renderCover)}
                </div>
            </div>

            {/* SEARCHBAR */}
            <div className={styles.searchInputWrapper}>
                <SearchInput
                    className={styles.searchInput}
                    inputId="telegram-search-input"
                    resultsItemSelector=".LeftSearch .ListItem-button"
                    value={searchQuery}
                    onChange={q => searchAsync(q)}
                    isLoading={isLoading}
                    placeholder="Search Emoji"//TODO create lang key
                    autoComplete="off"
                    withBackIcon={false}
                >

                </SearchInput>
            </div>


            <div
                ref={containerRef}
                onScroll={handleContentScroll}
                className={listClassName}
            >

                {/* SEARCH RESULT SET  */}
                {
                    (searchResults.length > 0) && (
                        <StickerSet
                            key={0}
                            stickerSet={{
                                id: SEARCH_SYMBOL_SET_ID,
                                stickers: searchResults,
                                title: 'Search results',
                                isEmoji: true,
                                count: searchResults.length
                                //  installedDate:1
                            } as any}
                            loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                            index={0}
                            idPrefix={prefix}
                            observeIntersection={observeIntersectionForSet}
                            observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                            observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                            isNearActive={false}
                            isFolderPicker={true}
                            shouldHideHeader={false}
                            withDefaultTopicIcon={false}
                            withDefaultStatusIcon={false}
                            isChatEmojiSet={false}
                            isCurrentUserPremium={isCurrentUserPremium}
                            selectedReactionIds={selectedReactionIds}
                            availableReactions={availableReactions}
                            onReactionSelect={onReactionSelect}
                            onReactionContext={onReactionContext}
                            onStickerSelect={handleEmojiSelect}
                            onContextMenuOpen={onContextMenuOpen}
                            onContextMenuClose={onContextMenuClose}
                            onContextMenuClick={onContextMenuClick}

                        />
                    )
                }

                {/* FOLDER SET  */}
                <StickerSet
                    key={folderSet.id}
                    stickerSet={folderSet}
                    loadAndPlay={false}
                    index={0}
                    idPrefix={prefix}
                    observeIntersection={observeIntersectionForSet}
                    observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                    observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                    isNearActive={false}
                    isFolderPicker={true}
                    shouldHideHeader={true}
                    withDefaultTopicIcon={false}
                    withDefaultStatusIcon={false}
                    isChatEmojiSet={false}
                    isCurrentUserPremium={isCurrentUserPremium}

                    onReactionSelect={onReactionSelect}
                    onReactionContext={onReactionContext}
                    onStickerSelect={handleEmojiSelect}
                    onContextMenuOpen={onContextMenuOpen}
                    onContextMenuClose={onContextMenuClose}
                    onContextMenuClick={onContextMenuClick}
                    noContextMenus={true}
                />


                {/* EMOJIS SET  */}
                <FolderEmojiSet
                    id={`${prefix}-${1}`}
                    index={1}

                    observeIntersection={observeIntersection}

                    onEmojiSelect={onCustomEmojiSelect}

                />


                {/* CUSTOM EMOJI SETS  */}
                {allSets.map((stickerSet, i) => {
                    const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
                        || (stickerSet.id === RECENT_SYMBOL_SET_ID && (withDefaultTopicIcons));
                    const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

                    return (
                        <StickerSet
                            key={stickerSet.id}
                            stickerSet={stickerSet}
                            loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                            index={i + 2}
                            idPrefix={prefix}
                            observeIntersection={observeIntersectionForSet}
                            observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                            observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                            isNearActive={activeSetIndex >= i + 2 - 1 && activeSetIndex <= i + 2 + 1}
                            isFolderPicker={true}
                            shouldHideHeader={shouldHideHeader}
                            withDefaultTopicIcon={withDefaultTopicIcons && stickerSet.id === RECENT_SYMBOL_SET_ID}
                            withDefaultStatusIcon={false}
                            isChatEmojiSet={isChatEmojiSet}
                            isCurrentUserPremium={isCurrentUserPremium}
                            selectedReactionIds={selectedReactionIds}
                            availableReactions={availableReactions}

                            onReactionSelect={onReactionSelect}
                            onReactionContext={onReactionContext}
                            onStickerSelect={handleEmojiSelect}
                            onContextMenuOpen={onContextMenuOpen}
                            onContextMenuClose={onContextMenuClose}
                            onContextMenuClick={onContextMenuClick}
                        />
                    );
                })}
            </div>
        </div>
    );
};



export default memo(withGlobal<OwnProps>(
    (global, { chatId }): StateProps => {
        const {
            stickers: {
                setsById: stickerSetsById,
            },
            customEmojis: {
                byId: customEmojisById,
                featuredIds: customEmojiFeaturedIds,
                statusRecent: {
                    emojis: recentStatusEmojis,
                },
            },
            recentCustomEmojis: recentCustomEmojiIds,
            reactions: {
                availableReactions,
                recentReactions,
                topReactions,
                defaultTags,
            },
        } = global;

        const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));
        const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

        const {
            language, shouldSuggestStickers, shouldSuggestCustomEmoji, shouldUpdateStickerSetOrder,
        } = global.settings.byKey;
        const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
        const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;

        return {
            customEmojisById: customEmojisById,
            recentCustomEmojiIds: recentCustomEmojiIds,
            recentStatusEmojis: recentStatusEmojis,
            stickerSetsById,
            addedCustomEmojiIds: global.customEmojis.added.setIds,
            canAnimate: selectCanPlayAnimatedEmojis(global),
            isSavedMessages,
            isCurrentUserPremium: selectIsCurrentUserPremium(global),
            customEmojiFeaturedIds,
            defaultTopicIconsId: global.defaultTopicIconsId,
            defaultStatusIconsId: global.defaultStatusIconsId,

            chatEmojiSetId: chatFullInfo?.emojiSet?.id,

            emojiKeywords: {
                ...emojiKeywords?.keywords,
                ...baseEmojiKeywords?.keywords,
            },
            
        };
    },
)(FolderEmojiPicker));
