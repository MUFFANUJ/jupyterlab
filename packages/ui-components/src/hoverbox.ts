// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

/**
 * The class name added to all hover boxes.
 */
const HOVERBOX_CLASS = 'jp-HoverBox';

/**
 * The class name added to hover boxes rendered above their anchor.
 */
const HOVERBOX_ABOVE_CLASS = 'jp-mod-above';

/**
 * The class name added to CSS anchor nodes used to position hover boxes.
 */
const HOVERBOX_ANCHOR_CLASS = 'jp-HoverBox-anchor';

/**
 * The class name added when block-axis fallback should be disabled.
 */
const HOVERBOX_FORCE_CLASS = 'jp-mod-force-position';

/**
 * A namespace for `HoverBox` members.
 */
export namespace HoverBox {
  /**
   * Options for setting the geometry of a hovering node and its anchor node.
   */
  export interface IOptions {
    /**
     * The referent anchor rectangle to which the hover box is bound.
     *
     * #### Notes
     * In an editor context, this value will typically be the cursor's
     * coordinate position, which can be retrieved via calling the
     * `getCoordinateForPosition` method.
     */
    anchor: IAnchor;

    /**
     * The node that hosts the anchor.
     */
    host: HTMLElement;

    /**
     * The maximum height of a hover box.
     *
     * #### Notes
     * This value is only used if a CSS max-height attribute is not set for the
     * hover box. It is a fallback value.
     */
    maxHeight: number;

    /**
     * The hover box node.
     */
    node: HTMLElement;

    /**
     * Optional pixel offset values added to where the hover box should render.
     *
     * #### Notes
     * This option is useful for passing in values that may pertain to CSS
     * borders or padding in cases where the text inside the hover box may need
     * to align with the text of the referent editor.
     *
     * Because the hover box calculation may render a box either above or below
     * the cursor, the `vertical` offset accepts `above` and `below` values for
     * the different render modes.
     */
    offset?: {
      horizontal?: number;
      vertical?: { above?: number; below?: number };
    };

    /**
     * If space is available both above and below the anchor, denote which
     * location is privileged. Use forceBelow and forceAbove to mandate where
     * hover box should render relative to anchor.
     *
     * #### Notes
     * The default value is `'below'`.
     */
    privilege?: 'above' | 'below' | 'forceAbove' | 'forceBelow';

    /**
     * If the style of the node has already been computed, it can be passed into
     * the hover box for geometry calculation.
     */
    style?: CSSStyleDeclaration;

    /**
     * Exact size of the hover box. Pass it for faster rendering (allowing the
     * positioning algorithm to to place it immediately at requested position).
     */
    size?: {
      width: number;
      height: number;
    };
  }

  /**
   * An interface describing anchor coordinates.
   */
  export interface IAnchor extends Pick<
    DOMRect,
    'left' | 'right' | 'top' | 'bottom'
  > {}

  /**
   * Set the visible dimensions of a hovering box anchored to an editor cursor.
   *
   * @param options - The hover box geometry calculation options.
   */
  export function setGeometry(options: IOptions): void {
    const { anchor, host, node, privilege } = options;
    const anchorData = Private.getAnchorData(node, host.ownerDocument);

    // Add hover box class if it does not exist.
    if (!node.classList.contains(HOVERBOX_CLASS)) {
      node.classList.add(HOVERBOX_CLASS);
    }

    // Start with the node displayed as if it was in view.
    if (node.style.visibility) {
      node.style.visibility = '';
    }

    // Clear any previously set max-height.
    node.style.maxHeight = '';

    const style = options.style || window.getComputedStyle(node);
    const maxHeight = parseInt(style.maxHeight!, 10) || options.maxHeight;

    // Determine whether to render above or below; check privilege.
    const renderBelow =
      privilege === 'forceAbove' ? false : privilege === 'above' ? false : true;

    node.classList.toggle(HOVERBOX_ABOVE_CLASS, !renderBelow);
    node.classList.toggle(
      HOVERBOX_FORCE_CLASS,
      privilege === 'forceAbove' || privilege === 'forceBelow'
    );
    node.style.maxHeight = `${maxHeight}px`;

    if (options.size) {
      node.style.width = `${options.size.width}px`;
      node.style.height = `${options.size.height}px`;
      node.style.contain = 'strict';
    } else {
      node.style.contain = '';
      node.style.width = 'auto';
      node.style.height = '';
    }

    const offsetAbove =
      (options.offset &&
        options.offset.vertical &&
        options.offset.vertical.above) ||
      0;
    const offsetBelow =
      (options.offset &&
        options.offset.vertical &&
        options.offset.vertical.below) ||
      0;
    const offsetHorizontal = (options.offset && options.offset.horizontal) || 0;

    Private.setAnchorGeometry(anchorData.node, anchorData.name, anchor);
    Private.setAnchorPosition(node, {
      anchorName: anchorData.name,
      offsetAbove,
      offsetBelow,
      offsetHorizontal
    });
  }
}

namespace Private {
  interface IAnchorData {
    hoverNode: HTMLElement;
    name: string;
    node: HTMLElement;
    ownerDocument: Document;
    observer: MutationObserver;
    observing: boolean;
  }

  let anchorId = 0;
  const anchorDataByNode = new WeakMap<HTMLElement, IAnchorData>();

  export function getAnchorData(
    node: HTMLElement,
    ownerDocument: Document
  ): IAnchorData {
    let data = anchorDataByNode.get(node);
    if (data && data.node.ownerDocument !== ownerDocument) {
      data.node.remove();
      untrackAnchor(data);
      data = undefined;
    }
    if (!data) {
      const anchorNode = ownerDocument.createElement('div');
      anchorNode.className = HOVERBOX_ANCHOR_CLASS;
      anchorNode.setAttribute('aria-hidden', 'true');
      data = {
        hoverNode: node,
        name: `--jp-hoverbox-anchor-${++anchorId}`,
        node: anchorNode,
        observer: new MutationObserver(() => {
          if (!node.isConnected) {
            anchorNode.remove();
            data?.observer.disconnect();
            anchorDataByNode.delete(node);
          }
        }),
        ownerDocument,
        observing: false
      };
      anchorDataByNode.set(node, data);
    }
    if (node.isConnected && !data.node.isConnected) {
      ownerDocument.body.appendChild(data.node);
      trackAnchor(data);
    }
    return data;
  }

  export function setAnchorGeometry(
    node: HTMLElement,
    name: string,
    anchor: HoverBox.IAnchor
  ): void {
    setStyleProperties(node, [
      ['--jp-hoverbox-anchor-name', name],
      ['--jp-hoverbox-anchor-left', `${anchor.left}px`],
      ['--jp-hoverbox-anchor-top', `${anchor.top}px`],
      [
        '--jp-hoverbox-anchor-width',
        `${Math.max(0, anchor.right - anchor.left)}px`
      ],
      [
        '--jp-hoverbox-anchor-height',
        `${Math.max(0, anchor.bottom - anchor.top)}px`
      ]
    ]);
  }

  export function setAnchorPosition(
    node: HTMLElement,
    options: {
      anchorName: string;
      offsetAbove: number;
      offsetBelow: number;
      offsetHorizontal: number;
    }
  ): void {
    setStyleProperties(node, [
      ['--jp-hoverbox-anchor-name', options.anchorName],
      ['--jp-hoverbox-offset-above', `${options.offsetAbove}px`],
      ['--jp-hoverbox-offset-below', `${options.offsetBelow}px`],
      ['--jp-hoverbox-offset-horizontal', `${options.offsetHorizontal}px`]
    ]);
  }

  function setStyleProperties(
    node: HTMLElement,
    properties: Array<[string, string]>
  ): void {
    for (const [name, value] of properties) {
      node.style.setProperty(name, value);
    }
  }

  function trackAnchor(data: IAnchorData): void {
    if (data.observing) {
      return;
    }
    data.observer.observe(data.ownerDocument.body, {
      childList: true,
      subtree: true
    });
    data.observing = true;
  }

  function untrackAnchor(data: IAnchorData): void {
    data.observer.disconnect();
    data.observing = false;
  }
}
