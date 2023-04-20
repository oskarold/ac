import { generateId, getPropertyValue } from "../util/changeUtils";
import { getArrowDownKey, getArrowLeftKey, getArrowRightKey, getArrowUpKey } from "../util/keyboard";

import { DoIt } from "../actions/view";
import PortalOverview from "./ui/PortalOverview";
import PropTypes from "prop-types";
import React from "react";
import ReactDOM from "react-dom";
import TextField from "./TextField";
import { flowControlTask } from "../actions/flowControl";
import { isArray } from "lodash";
import { macros } from "./ui/ShortCutKeys";
import shortcutListener from "./ui/ShortcutListener";

const AutoCompletePropTypes = PropTypes.arrayOf(PropTypes.oneOfType([

    // Med denna anger du vad du vill visa för information i kolumnerna i listan med val som visas för användaren.
    // listItemArgs={[{ property: "cusNo", title: "Kundnummer" }, { property: "name", title: "Kundnamn" }]}>
    // I exempel ovan har vi angett en property och en titel för sagd property. Property är det som vi vill visa i listan och titel är en överskrift på kolumnen.
    // Listan kan innehålla följande objektstrukturer:
    // Property: Enbart Property
    PropTypes.shape({
        property: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,

    }),
    // Property: Array av properties för en nästlad sökning.
    PropTypes.shape({
        property: PropTypes.array.isRequired,
        title: PropTypes.string.isRequired,

    }),
    // Property: Funktion för att returnera kolumn. 
    PropTypes.shape({
        property: PropTypes.func.isRequired,
        title: PropTypes.string.isRequired,

    })
]));

/**
 * Standardkomponent för att rendera innehåll. Render item.text
 */
class AutoCompleteItemContent extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            previousProp: "",
            currProp: ""
        };

        this.createArray = (arr, index, item) => {
            var prevProp = "";
            var currProp = "";

            return (<div className="auto-complete-list-item-col">
                {arr.forEach((x, index) => {
                    prevProp = currProp;
                    currProp = index == 0 ? item[x] : prevProp[x];
                })
                }
                {currProp}
            </div>);
        };
    }

    render() {
        const {
            item,
            itemList,

        } = this.props;
        return (
            <>
                {(itemList !== undefined && item === undefined) && (
                    <div className="auto-complete-list-item">
                        {itemList.map((element, index) => (
                            <div key={index.id} className="auto-complete-list-item-col">
                                {element["title"]}
                            </div>
                        ))}
                    </div>
                )}

                {(item !== undefined && itemList) && (
                    <div className="auto-complete-list-item">
                        {itemList.map((element, index) =>
                            typeof itemList[index]["property"] === "function" ? (

                                <div key={index.id} className="auto-complete-list-item-col">
                                    {itemList[index]["property"](item)}
                                </div>

                            ) :
                                isArray(itemList[index]["property"]) ? (
                                    this.createArray(itemList[index]["property"], index, item)
                                )
                                    : (
                                        <div key={index.id} className="auto-complete-list-item-col">
                                            {item[itemList[index]["property"]]}
                                        </div>
                                    )
                        )}
                    </div>
                )}
            </>

        );
    }
}

AutoCompleteItemContent.propTypes = {
    item: PropTypes.shape({
        property: PropTypes.string,
        title: PropTypes.string
    }),
    itemList: PropTypes.array.isRequired

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
            onSelectItem,
            listItemArgs,
            index
        } = this.props;
        return (
            <>
                {index === 0 && (
                    <li id={id} tabIndex={"0"}>
                        <AutoCompleteItemContent itemList={listItemArgs} />
                    </li>
                )}

                <li id={id} onClick={this.onClick} tabIndex={"0"}>
                    <AutoCompleteItemContent item={item} onSelectItem={onSelectItem} itemList={listItemArgs} onClick={this.onClick} />
                </li>
            </>
        );
    }
}

AutoCompleteItem.propTypes = {
    id: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
    itemContentComponent: PropTypes.any,
    onSelectItem: PropTypes.func.isRequired,
    listItemArgs: AutoCompletePropTypes,
    index: PropTypes.number.isRequired

};

/**
 * Textfält samt lista med val som matchar inmatad text.
 */
export default class AutoCompleteTEST extends React.PureComponent {
    constructor(props) {
        super(props);
        this.unique = generateId();
        this.setId = index => `${this.unique}_${index}`;
        this.parseId = id => id.split("_");

        this.isItMounted = false;
        this.gridIgnoreKeysOnVisiblePortal = ["Enter", "Tab", ...getArrowLeftKey(), ...getArrowRightKey(), ...getArrowUpKey(), ...getArrowDownKey(), "PageDown", "PageUp"];

        this.state = {
            activeOption: 0, // Vilket val som är aktiv (markerad) i dropdown-menyn
            filteredOptions: [],  // En filtrerad lista av options baserat på vad användaren skriver
            showPortal: false, // Om dropdown-menyn ska visas eller inte
            userInput: "",  // Vad användaren skriver i sökfältet
            items: [],
            uniqueId: this.unique.toString(),
            direction: {
                up: false,
                down: false,
            },
        };
        this.scrollRef = React.createRef();

        this.onEdit = (source, change) => {
            flowControlTask(this.state.uniqueId, () => {
                const searchValue = getPropertyValue(change, "search");
                return this.props.onSearch(searchValue);

            }, payload => this.gotNewData(payload, getPropertyValue(change, "search")), DoIt.NOW);
            if (this.isItMounted) {
                this.setState(() => {

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

        this.onDataChange = (userInput) => {
            this.setState({
                search: userInput || "",
            });
        };

        //stänger listan med alternativ under/över fältet.
        this.closePortal = () => {
            if (this.isItMounted) {
                this.setState({
                    showPortal: false
                });
            }
        };

        //Körs när man väljer ett val i listan av autocomplete
        this.onSelectItem = (item) => {
            this.closePortal();
            item = this.state.items[this.getFocusedItemIndex()];
            this.props.onSelectItem(item);
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
        if (this.state.direction.up && !prevState.direction.up) {
            const scrollHeight = this.scrollRef.current.scrollHeight;
            const height = this.scrollRef.current.clientHeight;
            const maxScrollTop = scrollHeight - height;
            this.scrollRef.current.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
        }
    }

    componentWillUnmount() {
        this.isItMounted = false;
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
            if (focusedItemIndex == -1)
                focusedItemIndex += 2;
            else
                focusedItemIndex += 1;
            const domNode = ReactDOM.findDOMNode(this.refs[this.setId(focusedItemIndex)]);
            if (domNode) {
                domNode.focus();
                this.handlePreview(items[focusedItemIndex]);
            }
            return true;
        }
        return false; // Returnera false här när du når slutet av listan.
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
        if (focusedItemIndex === 0)
            focusedItemIndex = 1;
        if (focusedItemIndex > 0) {
            focusedItemIndex -= 1;
            const domNode = ReactDOM.findDOMNode(this.refs[this.setId(focusedItemIndex)]);
            if (domNode) {
                domNode.focus();
                this.handlePreview(items[focusedItemIndex]);
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
     * formatPreview, onPreview och handlePreview sköter visning av propertyn i textfältet medans användaren rör sig upp och ner i listan med förslag.
     * @param {void} item
     * @returns {item}
     */
    formatPreviewStr = (item) => {
        return item[this.props.listItemArgs[0].property];
    }

    /**
     * @param {void} item
     * @returns {item}
     */
    onPreviewItem = (item) => {
        return (`Previewing item: ${item.property}`);
    }

    /**
     * @param {void} item
     * @returns {item}
     */
    handlePreview = (item) => {
        const str = this.formatPreviewStr(item);
        this.setState({
            search: str,
            searchSave: this.state.searchSave === undefined ? this.state.search : this.state.searchSave,
            showPortal: true
        });
        this.onPreviewItem(item);
    }


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
        let focusedItemIndex = 0;
        if (focusedId != "" && this.parseId(focusedId)[0] === this.state.uniqueId) {
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
            if (search.length === 0) {
                this.closePortal();
                const item = undefined;
                this.props.onSelectItem(item);
            } else {
                flowControlTask(this.state.uniqueId, () => {
                    return this.props.onSearch(search);
                }, payload => {
                    if (payload.length > 0) {
                        this.gotNewData(payload, search);
                        this.props.onSelectItem(payload[0]);
                        this.closePortal();
                    }
                }, DoIt.NOW);
            }

            return true;
        }

        const items = this.state.items;
        const focusedItemIndex = this.getFocusedItemIndex();

        if (focusedItemIndex >= 1) {
            // Om ett alternativ i dropdown listan är fokuserat, välj värdet och stäng söklistan.
            this.closePortal();
            const item = items[focusedItemIndex];
            this.props.onSelectItem(item);
        } else if (focusedItemIndex === -1 && this.state.search.length === 0) {
            // Om inget alternativ i dropdown listan är fokuserat och längden på söksträngen är 0, välj undefined som värde för att rensa det från fältet och stäng söklistan.
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
        const textFieldDOMNode = ReactDOM.findDOMNode(this.refs.textField);
        if (textFieldDOMNode) {
            textFieldDOMNode.focus();
        }
        return true;
    }

    render() {
        const {
            listItemArgs
        } = this.props;
        const item = document.getElementById(this.state.uniqueId);
        const showPortal = this.state.showPortal && this.state.items.length !== 0;
        const style = {
        };

        // Skapar en lista med options baserat på vad användaren skrivit in
        return (
            <React.Fragment>
                <div className={"auto-complete"} id={this.state.uniqueId} onFocusCapture={this.showPortalForExistingData} ref={this.scrollRef}>
                    <TextField
                        autoFocus={false}
                        disabled={false}
                        onChange={this.onEdit}
                        onEdit={this.onEdit}
                        property="search"
                        source={this.state}
                        ref="textField"
                        maxLength={1000}
                        onClick={this.showPortalForExistingData}
                        placeholder={""} />
                    {showPortal && (
                        <PortalOverview
                            parentElement={item}
                            onClose={this.closePortal}
                            returnFocusOnTabbingOut={false}>
                            <div className="autocomplete-portal">
                                <div className={"auto-complete-list"} ref={this.scrollRef} style={style}>
                                    <ul className={"auto-complete-list-items"}>
                                        {this.state.items.map((item, index) => {
                                            if (index === 0) {
                                                return (
                                                    <AutoCompleteItem
                                                        id={this.setId(index)}
                                                        items={this.state.items}
                                                        onSelectItem={this.onSelectItem}
                                                        ref={this.setId(index)}
                                                        listItemArgs={listItemArgs}
                                                        key={index}
                                                        index={index}
                                                        item={item}
                                                    />
                                                );
                                            } else {
                                                return (
                                                    <AutoCompleteItem
                                                        id={this.setId(index)}
                                                        items={this.state.items}
                                                        onSelectItem={this.onSelectItem}
                                                        ref={this.setId(index)}
                                                        listItemArgs={listItemArgs}
                                                        key={index}
                                                        index={index}
                                                        item={item}
                                                    />
                                                );
                                            }
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </PortalOverview>)}
                </div>
            </React.Fragment>
        );
    }
}

AutoCompleteTEST.propTypes = {

    listItemArgs: AutoCompletePropTypes,

    //Denna triggas när man väljer ett alternativ i listan. Funktion behöver skrivas för vad som ska hända med värdet som plockas genom autocompletefältet.
    onSelectItem: PropTypes.func.isRequired,

    //onSearch(text) => Promise som evaluerar till en array av items
    onSearch: PropTypes.func.isRequired

};

AutoCompleteTEST.defaultProps = {
    autoFocus: true
};


