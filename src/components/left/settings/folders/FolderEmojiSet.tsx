import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useEffect, useRef, useState } from '../../../../lib/teact/teact';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import buildClassName from '../../../../util/buildClassName';
import { useOnIntersect } from '../../../../hooks/useIntersectionObserver';
import useMediaTransitionDeprecated from '../../../../hooks/useMediaTransitionDeprecated';
import Button from '../../../ui/Button';
import EmojiButton from '../../../middle/composer/EmojiButton';
import useFlag from '../../../../hooks/useFlag';
import { EmojiData, EmojiModule, uncompressEmoji } from '../../../../util/emoji/emoji';
import { getItemsPerRowFallback } from '../../../common/StickerSet';
import useWindowSize from '../../../../hooks/window/useWindowSize';
import useLang from '../../../../hooks/useLang';

import './FolderEmojiSet.scss'

type OwnProps = {
    index: number;
    observeIntersection: ObserveFn;
    onEmojiSelect: (emoji: string, name: string) => void;
    id?: string;
};

const EmojiCategory: FC<OwnProps> = ({
    index, observeIntersection, onEmojiSelect, id
}) => {
    const [isCutEmoji, , expand] = useFlag(true);
    const [category, setCategory] = useState<EmojiCategory>();
    const { width: windowWidth } = useWindowSize();
    const [emojisPerRow, setItemsPerRow] = useState(getItemsPerRowFallback(windowWidth));
    // eslint-disable-next-line no-null/no-null
    const ref = useRef<HTMLDivElement>(null);

    useOnIntersect(ref, observeIntersection);

    const transitionClassNames = useMediaTransitionDeprecated(true);
    const lang = useLang();
   
    const allEmojis = useRef<EmojiData>();
    const emojisLeftAfterCut = useRef(0);
    useEffect(() => {        
            const exec = () => {
                const peopleCategoryFull = {
                    ...allEmojis.current!.categories.find(c => c.id === 'people')!
                };

                if (peopleCategoryFull) {
                    if (isCutEmoji) {
                        const itemsBeforeCutout = emojisPerRow * 3 - 1;
                        emojisLeftAfterCut.current = peopleCategoryFull.emojis.length - itemsBeforeCutout;
                        peopleCategoryFull.emojis = peopleCategoryFull.emojis.slice(0, itemsBeforeCutout)
                     
                    }
                    setCategory(peopleCategoryFull);
                }
            };

            if (allEmojis.current) {
                exec();
            } else {
                let emojiDataPromise: Promise<EmojiModule>;
                const ensureEmojiData = async () => {
                    if (!emojiDataPromise) {
                        emojiDataPromise = import('emoji-data-ios/emoji-data.json');
                        const emojiRawData = (await emojiDataPromise).default;

                        allEmojis.current = (uncompressEmoji(emojiRawData));
                    }
                    return emojiDataPromise;
                }

                ensureEmojiData().then(exec);
            }       
    }, [isCutEmoji]);


    return (
        <div
            ref={ref}
            id={id}
            className="FolderEmojiSet symbol-set"
        >
            {category && (
                <>
                    <div className="symbol-set-header">
                        <p className="symbol-set-name" dir="auto">
                            {lang("EmojiSetSmileysAndPeople")}
                        </p>
                    </div>
                    <div
                        className={buildClassName('symbol-set-container', transitionClassNames)}
                        // style={`height: ${height}px;`}
                        dir={lang.isRtl ? 'rtl' : undefined}
                    >
                        {category.emojis.map((name) => {
                            const emoji = allEmojis.current?.emojis[name]                           
                            // Recent emojis may contain emoticons that are no longer in the list
                            if (!emoji) {
                                return undefined;
                            }
                            // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
                            // For now, we select only the first emoji with 'neutral' skin.
                            const displayedEmoji = 'id' in emoji ? emoji : emoji[1];

                            return (
                                <EmojiButton
                                    key={displayedEmoji.id}
                                    emoji={displayedEmoji}
                                    onClick={onEmojiSelect}
                                />
                            );
                        })}

                        {true && (
                            <Button
                                className="StickerButton custom-emoji set-expand"
                                round
                                color="translucent"
                                onClick={expand}
                                key="more"
                            >
                                +{emojisLeftAfterCut.current}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default memo(EmojiCategory);