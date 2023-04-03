import "../../styles/autoComplete.scss";

import Icon, { iconTypes } from "./ui/Icon";
import { getArrowDownKey, getArrowLeftKey, getArrowRightKey, getArrowUpKey } from "../util/keyboard";

import { DoIt } from "../actions/view";
import PortalOverview from "./ui/PortalOverview";
import PropTypes from "prop-types";
import React from "react";
import ReactDOM from "react-dom";
import TextField from "./TextField";
import { flowControlTask } from "../actions/flowControl";
import { getPropertyValue } from "../util/changeUtils";
import { macros } from "./ui/ShortCutKeys";
import shortcutListener from "./ui/ShortcutListener";

/**
 * Standardkomponent för att rendera innehåll. Render item.text
 */
class AutoCompleteItemContent extends React.PureComponent {
    constructor(props) {
        super(props);
    }

    render() {
        const {
            item: {
                textCol1,
                textCol2
            }
        } = this.props;
        return (
            <div className="auto-complete-list-item">
                <div className="auto-complete-list-item-col">
                    {textCol1}
                </div>
                {textCol2 &&
                    <div className="auto-complete-list-item-col">
                        {textCol2}
                    </div>
                }
            </div>
        );
    }
}

AutoCompleteItemContent.propTypes = {
    item: PropTypes.shape({
        textCol1: PropTypes.string.isRequired,
        textCol2: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    }).isRequired
};

/**
 * Komponent för en träff i autocompletion.
 */
class AutoCompleteItem extends React.PureComponent {
    constructor(props) {
        super(props);
        this.onClick = () => this.props.onSelectItem(this.props.item);
    }

    render() {
        const {
            id,
            item,
            itemContentComponent,
            onSelectItem,
        } = this.props;
        return (
            <li id={id} onClick={this.onClick} tabIndex={"0"}>
                {itemContentComponent ? React.createElement(itemContentComponent, {
                    item
                }) : <AutoCompleteItemContent item={item} onSelectItem={onSelectItem} />
                }
            </li>
        );
    }
}

AutoCompleteItem.propTypes = {
    id: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
    itemContentComponent: PropTypes.any,
    onSelectItem: PropTypes.func.isRequired,
};

/**
 * Textfält samt lista med val som matchar inmatad text.
 */
export default class AutoComplete extends React.PureComponent {
    constructor(props) {
        super(props);

        this.setId = index => `${this.props.uniqueId}_${index}`;
        this.parseId = id => id.split("_");

        this.isItMounted = false;
        this.gridIgnoreKeysOnVisiblePortal = ["Enter", "Tab", ...getArrowLeftKey(), ...getArrowRightKey(), ...getArrowUpKey(), ...getArrowDownKey(), "PageDown", "PageUp"];

        this.state = {
            items: [],
            search: props.initialSearch || "",
            searchSave: undefined,
            showPortal: false,
            uniqueId: `autoCompleteId${props.uniqueId.toString()}`,
            direction: {
                up: false,
                down: false,
            },
        };

        this.scrollRef = React.createRef();

        this.onEdit = (source, change) => {
            if (this.props.preview && this.props.preview.onPreviewEdit) {
                this.props.preview.onPreviewEdit(getPropertyValue(change, "search"));
            }
            flowControlTask(this.props.uniqueId, () => {
                const searchValue = getPropertyValue(change, "search");
                return this.props.onSearch(searchValue);

            }, payload => this.gotNewData(payload, getPropertyValue(change, "search")), DoIt.NOW);
            if (this.isItMounted) {
                this.setState((prevState) => {
                    if (!prevState.showPortal && this.props.callbackGridIgnoreKeys) {
                        this.props.callbackGridIgnoreKeys(this.gridIgnoreKeysOnVisiblePortal);
                    }
                    return {
                        ...change,
                        showPortal: true
                    };
                });
            }
        };

        this.gotNewData = (payload, searchValueUsedInOnSearchCall) => {
            if (this.isItMounted) {
                this.setState({
                    items: payload,
                    searchValueUsedInOnSearchCall
                });
            }
        };

        this.closePortal = () => {
            if (this.isItMounted) {
                this.setState({
                    showPortal: false
                });
                if (this.props.callbackGridIgnoreKeys) {
                    this.props.callbackGridIgnoreKeys([]);
                }
            }
        };

        this.clearSearchField = () => {
            this.setState({
                search: "",
                items: []
            });
        };

        this.onSelectItem = (item) => {
            this.closePortal();
            this.clearSearchField();
            this.props.onSelectItem(item);
        };

        this.showPortalForExistingData = () => {
            if (this.props.preview && this.state.items.length > 0 && this.state.search !== "") {
                this.setState({
                    showPortal: true
                });
                if (this.props.callbackGridIgnoreKeys) {
                    this.props.callbackGridIgnoreKeys(this.gridIgnoreKeysOnVisiblePortal);
                }
            }
        };
        this.onDataChange = (initialSearch) => {
            this.setState({
                search: initialSearch || "",
            });
        };
        this.getDropDownDirection = (direction) => {
            this.setState({
                direction,
            });
        };
    }

    componentDidMount() {
        this.isItMounted = true;
        shortcutListener.subscribe(macros.moveUp, this.onKeyUp, 3);
        shortcutListener.subscribe(macros.moveDown, this.onKeyDown, 3);
        shortcutListener.subscribe(macros.autoComplete_Escape, this.onKeyEscape, 3);
        shortcutListener.subscribe(macros.autoComplete_Enter, this.onKeyTabOrEnter, 3);
        shortcutListener.subscribe(macros.autoComplete_NumpadEnter, this.onKeyTabOrEnter, 3);
        shortcutListener.subscribe(macros.tab, this.onKeyTabOrEnter, 3);

    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.initialSearch !== prevProps.initialSearch && this.props.initialSearch !== this.state.search) {
            this.onDataChange(this.props.initialSearch);
        }
        if (this.state.direction.up && !prevState.direction.up) {
            const scrollHeight = this.scrollRef.current.scrollHeight;
            const height = this.scrollRef.current.clientHeight;
            const maxScrollTop = scrollHeight - height;
            this.scrollRef.current.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
        }
    }

    componentWillUnmount() {
        this.isItMounted = false;
        if (this.props.callbackGridIgnoreKeys) {
            this.props.callbackGridIgnoreKeys([]);
        }
        shortcutListener.unsubscribe(macros.moveUp, this.onKeyUp);
        shortcutListener.unsubscribe(macros.moveDown, this.onKeyDown);
        shortcutListener.unsubscribe(macros.autoComplete_Escape, this.onKeyEscape);
        shortcutListener.unsubscribe(macros.autoComplete_Enter, this.onKeyTabOrEnter);
        shortcutListener.unsubscribe(macros.autoComplete_NumpadEnter, this.onKeyTabOrEnter);
        shortcutListener.unsubscribe(macros.tab, this.onKeyTabOrEnter);

    }

    /**
     * Går ner i listan av alternativ.
     * @returns {void}
     */
    dirDown = () => {
        const items = this.state.items;
        if (!this.state.showPortal || items.length === 0) {
            return false;
        }
        let focusedItemIndex = this.getFocusedItemIndex();
        if (focusedItemIndex <= (items.length - 1)) {
            focusedItemIndex += 1;
            const domNode = ReactDOM.findDOMNode(this.refs[this.setId(focusedItemIndex)]);
            if (domNode) {
                domNode.focus();
                if (this.props.preview) {
                    const item = items[focusedItemIndex];
                    const str = this.props.preview.formatPreviewStr(item);
                    this.setState({
                        search: str,
                        searchSave: this.state.searchSave === undefined ? this.state.search : this.state.searchSave,
                        showPortal: true
                    });
                    this.props.preview.onPreviewItem(item);
                }
            }
            return true;
        }

    };

    /**
     * Går upp i listan av alternativ.
     * @returns {void}
     */
    dirUp = () => {
        const items = this.state.items;
        if (!this.state.showPortal || items.length === 0) {
            return false;
        }

        let focusedItemIndex = this.getFocusedItemIndex();
        if (focusedItemIndex > 0) {
            focusedItemIndex -= 1;
            const domNode = ReactDOM.findDOMNode(this.refs[this.setId(focusedItemIndex)]);
            if (domNode) {
                domNode.focus();
                if (this.props.preview) {
                    const item = items[focusedItemIndex];
                    const str = this.props.preview.formatPreviewStr(item);
                    this.setState({
                        search: str,
                        searchSave: this.state.searchSave === undefined ? this.state.search : this.state.searchSave,
                        showPortal: true
                    });
                    this.props.preview.onPreviewItem(item);
                }
            }
            return true;
        } else {
            const textFieldDOMNode = ReactDOM.findDOMNode(this.refs.textField);
            if (textFieldDOMNode) {
                textFieldDOMNode.focus();
                return true;
            }
        }
    };

    /**
     * Anropas när tangent pil-upp trycks. Om dropdown menyn är ovanför, så reverseras inputen.
     * @returns {void}
     */
    onKeyUp = () => {
        if (this.state.direction.up) {
            return this.dirDown();

        } else {
            return this.dirUp();

        }
    };

    /**
        * Anropas när tangent pil-ned trycks. Om dropdown menyn är ovanför, reverseras inputen.
        * @returns {void}
        */
    onKeyDown = () => {
        if (this.state.direction.up) {
            return this.dirUp();
        } else {
            return this.dirDown();
        }
    };

    /**
     * Hämtar index för markerat element i list-menyn.
     * @returns {number}
     */
    getFocusedItemIndex = () => {
        const focusedId = document.activeElement && document.activeElement.id;
        let focusedItemIndex = -1;
        if (focusedId != "" && this.parseId(focusedId)[0] === this.props.uniqueId) {
            focusedItemIndex = parseInt(this.parseId(focusedId)[1]);
        }
        return focusedItemIndex;
    }

    /**
     * Vid tabtryckning. väljer rätt element och stänger ner listalternativen från att visas
     * @returns {bool}
     */
    onKeyTabOrEnter = () => {
        if (!this.state.showPortal) {
            return;
        }

        // Kollar om onEdit redan hunnit köra onSearch för den textsträng man skrivit in i autocomplete-fältet.
        // Om inte, så tvinga fram ett nytt anrop till onSearch med texten som står i fältet.
        // Används då man skriver in text i fältet följt av väldigt snabbt, nästan instant trycka på enter eller tab. 
        const apiParameterNotUpToDate = this.state.search !== this.state.searchValueUsedInOnSearchCall;
        if (apiParameterNotUpToDate) {
            const search = this.state.search;
            // Om man tömt fältet så behöver vi ej ställa frågan och kan då nulla resultatet i fältet.
            if (search.length === 0 && this.props.allowClear === true) {
                this.closePortal();
                const item = undefined;
                this.props.onSelectItem(item);
            } else {
                flowControlTask(this.props.uniqueId, () => {
                    return this.props.onSearch(search);
                }, payload => {
                    if (payload.length > 0) {
                        this.gotNewData(payload, search);
                        this.props.onSelectItem(payload[0]);
                        this.closePortal();
    
                        if (this.props.onShortcutkeyCellRightWrap) {
                            this.props.onShortcutkeyCellRightWrap();
                        }
                    }
                }, DoIt.NOW);
            }

            return true;
        }
        const items = this.state.items;
        const focusedItemIndex = this.getFocusedItemIndex();
        if (focusedItemIndex >= 0) {
            // Om ett alternativ i dropdown listan är fokuserat, välj värdet och stäng söklistan.
            this.closePortal();
            const item = items[focusedItemIndex];
            this.props.onSelectItem(item);
        } else if (focusedItemIndex === -1 && this.state.search.length === 0 && this.props.allowClear === true) {
            // Om inget alternativ i dropdown listan är fokuserat och längden på söksträngen är 0 samt allowClear är true, välj undefined som värde för att rensa det från fältet och stäng söklistan.
            this.closePortal();
            const item = undefined;
            this.props.onSelectItem(item);
        } else if (focusedItemIndex === -1 && items.length !== 0) {
            // Om inget alternativ i dropdown listan är fokuserat och längden på listan är större än 0, välj första alternativet i söklistan och stäng den.
            this.closePortal();
            const item = items[0];
            this.props.onSelectItem(item);
        } else if (focusedItemIndex === -1) {
            this.closePortal();
        }

        return false;

    }

    /**
     * Vid knapptryckning på Esc /Escape så stängs list-alternativen ner.
     * @returns {*}
     */
    onKeyEscape = () => {
        if (!this.state.showPortal) {
            return false;
        }
        this.closePortal();
        this.setState({
            search: this.state.searchSave !== undefined ? this.state.searchSave : this.state.search
        });
        if (this.props.preview) {
            this.props.preview.onPreviewItem(undefined);
        }
        const textFieldDOMNode = ReactDOM.findDOMNode(this.refs.textField);
        if (textFieldDOMNode) {
            textFieldDOMNode.focus();
        }
        return true;
    }

    render() {
        const {
            disabled,
            itemContentComponent,
            loading,
            className,
            maxLength,
            placeholder,
        } = this.props;

        const item = document.getElementById(this.state.uniqueId);

        const showPortal = this.state.showPortal && this.state.items.length !== 0;

        return (
            <div className={`auto-complete ${className ? className : ""}`} id={this.state.uniqueId} onFocusCapture={this.showPortalForExistingData} ref={this.scrollRef}>
                <TextField
                    autoFocus={this.props.autoFocus}
                    disabled={disabled}
                    onChange={this.onEdit}
                    onEdit={this.onEdit}
                    property="search"
                    source={this.state}
                    ref="textField"
                    maxLength={maxLength}
                    onClick={this.showPortalForExistingData}
                    placeholder={placeholder} />
                {loading && <div className="loading-icon"><Icon type={iconTypes.spinner} /></div>}
                {showPortal && (
                    <PortalOverview parentElement={item}
                        className={className}
                        onClose={this.closePortal}
                        onDirectionCallback={this.getDropDownDirection}
                        returnFocusOnTabbingOut={false}>
                        <div className="autocomplete-portal">
                            <div className={`auto-complete-list ${className ? className : ""}${this.state.direction.up ? " reverse" : ""}`} ref={this.scrollRef}>
                                <ul className={`auto-complete-list-items${this.state.direction.up ? " reverse" : ""}`}>
                                    {this.state.items.map((item, index) => (
                                        <AutoCompleteItem
                                            id={this.setId(index)}
                                            item={item}
                                            itemContentComponent={itemContentComponent}
                                            key={index}
                                            onSelectItem={this.onSelectItem}
                                            ref={this.setId(index)} />
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </PortalOverview>
                )}
            </div>
        );
    }
}

AutoComplete.propTypes = {
    /**
     * Boolean som bedömmer huruvida resultatet skall få rensas ur fältet. Om sökfältet är tomt, inget alternativ i söklistan är fokuserat och man trycker på tab eller enter så rensas värdet då
     * denna property är satt till true. Används av AutoComplete-fält där man vill kunna rensa värdet i fältet.
     */
    allowClear: PropTypes.bool,

    /**
     * Autofokus aktiverad på textfältet i komponenten (default true)
     */
    autoFocus: PropTypes.bool,

    /**
     * Möjliggör att disabla komponenten
     */
    disabled: PropTypes.bool,

    /*
     * Tex när autocomplete ligger i gridden, defaulta in ett värde
     */
    initialSearch: PropTypes.string,

    /**
     * Komponent för egen rendering av saks innehåll
     */
    itemContentComponent: PropTypes.any,

    /**
     * Visar spinnande indikator
     */
    loading: PropTypes.bool,

    /*
     * Begränsa input
     */
    maxLength: PropTypes.number.isRequired,

    /**
     * onSearch(text) => Promise som evaluerar till en array av items
     */
    onSearch: PropTypes.func.isRequired,

    /**
     * onSelectItem(item)
     * Exekveras då en rad väljs
     */
    onSelectItem: PropTypes.func.isRequired,

    /**
     * Visar text när autocompletion är tom
     */
    placeholder: PropTypes.string,

    /*
     * När användaren går i listan med pil upp/ner visas item i sökfältet
     */
    preview: PropTypes.shape({
        /*
         * formatPreviewStr(item)
         * hur item formateras i editfältet
         */
        formatPreviewStr: PropTypes.func.isRequired,

        /*
         * onPreviewItem(item)
         * Vill man välja med tex > knapp är det denna item
         */
        onPreviewItem: PropTypes.func.isRequired,

        /*
         * onPreviewEdit(text)
         * För gridden, vad som skrivs i editfältet
         */
        onPreviewEdit: PropTypes.func
    }),

    /**
     * Unikt id som identifierar autocompletion fältet. Används även av flowControlTask.
     */
    uniqueId: PropTypes.string.isRequired,

    /**
     * Tilldelat ett dynamiskt klassnamn för CSS.
     */
    className: PropTypes.string,

    /**
     * Callback för att sätta keys som behövs för tillfället.
     * Detta så att grid inte käkar upp dem.
     */
    callbackGridIgnoreKeys: PropTypes.func,

    /**
     * Används endast om AutoCompleten ligger i en Cell innuti en Grid.
     * 
     * Funktion som anropas efter att man trycker på Tab eller Enter.
     * Hoppar till nästa lediga fält i gridden. 
     * Används så att den först hoppar till nästa cell _efter_ att data laddats in i raden.
     * Samt att den stannar kvar i cellen om ingen träff sker. 
     */
    onShortcutkeyCellRightWrap: PropTypes.func,
};

AutoComplete.defaultProps = {
    autoFocus: true
};
