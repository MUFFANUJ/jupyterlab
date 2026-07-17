/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { HoverBox } from '@jupyterlab/ui-components';

function createDomRect(options: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    ...options,
    bottom: options.y + options.height,
    top: options.y,
    left: options.x,
    right: options.x + options.width,
    toJSON: () => 'DummyDOMRect'
  };
}

function createPointAnchor(options: { x: number; y: number }): DOMRect {
  return createDomRect({ ...options, width: 0, height: 0 });
}

function getCustomProperty(node: HTMLElement, name: string): string {
  return node.style.getPropertyValue(name);
}

function getAnchorNode(): HTMLElement {
  return document.body.querySelector('.jp-HoverBox-anchor')!;
}

describe('@jupyterlab/ui-components', () => {
  describe('HoverBox.setGeometry()', () => {
    let host: HTMLElement;
    let node: HTMLElement;
    let anchor: DOMRect;
    let defaults: () => {
      host: HTMLElement;
      node: HTMLElement;
      anchor: DOMRect;
      maxHeight: number;
    };

    beforeEach(() => {
      host = document.createElement('div');
      node = document.createElement('div');
      anchor = createPointAnchor({
        x: 50,
        y: 50
      });
      defaults = () => {
        return { host, anchor, node, maxHeight: 100 };
      };
    });

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('should position node with a CSS anchor', () => {
      const getHostRect = jest.spyOn(host, 'getBoundingClientRect');
      const getNodeRect = jest.spyOn(node, 'getBoundingClientRect');
      document.body.appendChild(node);

      HoverBox.setGeometry(defaults());

      const anchorNode = getAnchorNode();
      const anchorName = getCustomProperty(
        anchorNode,
        '--jp-hoverbox-anchor-name'
      );
      expect(anchorName).toMatch(/^--jp-hoverbox-anchor-/);
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-left')).toBe(
        '50px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-top')).toBe(
        '50px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-width')).toBe(
        '0px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-height')).toBe(
        '0px'
      );
      expect(getCustomProperty(node, '--jp-hoverbox-anchor-name')).toBe(
        anchorName
      );
      expect(node.getAttribute('style')).not.toContain('anchor(');
      expect(node.getAttribute('style')).not.toContain('position-anchor');
      expect(getHostRect).not.toHaveBeenCalled();
      expect(getNodeRect).not.toHaveBeenCalled();
    });

    it('should not append a CSS anchor for a detached positioned node', () => {
      HoverBox.setGeometry(defaults());

      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeNull();
      expect(getCustomProperty(node, '--jp-hoverbox-anchor-name')).toMatch(
        /^--jp-hoverbox-anchor-/
      );

      document.body.appendChild(node);
      HoverBox.setGeometry(defaults());
      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeTruthy();
    });

    it('should reuse the CSS anchor for subsequent geometry updates', () => {
      document.body.appendChild(node);
      HoverBox.setGeometry(defaults());
      const anchorNode = getAnchorNode();
      const anchorName = getCustomProperty(
        anchorNode,
        '--jp-hoverbox-anchor-name'
      );

      anchor = createPointAnchor({
        x: 75,
        y: 25
      });
      HoverBox.setGeometry(defaults());

      expect(
        document.body.querySelectorAll('.jp-HoverBox-anchor')
      ).toHaveLength(1);
      expect(getAnchorNode()).toBe(anchorNode);
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-name')).toBe(
        anchorName
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-left')).toBe(
        '75px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-top')).toBe(
        '25px'
      );
    });

    it('should remove CSS anchor when positioned node is removed', async () => {
      document.body.appendChild(node);
      HoverBox.setGeometry(defaults());
      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeTruthy();

      node.remove();
      await Promise.resolve();

      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeNull();
    });

    it('should remove CSS anchor when a positioned node ancestor is removed', async () => {
      const container = document.createElement('div');
      container.appendChild(node);
      document.body.appendChild(container);
      HoverBox.setGeometry(defaults());
      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeTruthy();

      container.remove();
      await Promise.resolve();

      expect(document.body.querySelector('.jp-HoverBox-anchor')).toBeNull();
    });

    it('should position node above the anchor when requested', () => {
      HoverBox.setGeometry({
        ...defaults(),
        privilege: 'forceAbove'
      });

      expect(node.classList.contains('jp-mod-above')).toBe(true);
      expect(node.classList.contains('jp-mod-force-position')).toBe(true);
    });

    it('should apply offsets and exact size without measuring node', () => {
      const getNodeRect = jest.spyOn(node, 'getBoundingClientRect');

      HoverBox.setGeometry({
        ...defaults(),
        offset: {
          horizontal: -5,
          vertical: {
            below: 7
          }
        },
        size: {
          width: 60,
          height: 20
        }
      });

      expect(node.style.width).toBe('60px');
      expect(node.style.height).toBe('20px');
      expect(node.style.contain).toBe('strict');
      expect(getCustomProperty(node, '--jp-hoverbox-offset-below')).toBe('7px');
      expect(getCustomProperty(node, '--jp-hoverbox-offset-horizontal')).toBe(
        '-5px'
      );
      expect(getNodeRect).not.toHaveBeenCalled();
    });

    it('should anchor to a rectangular coordinate', () => {
      document.body.appendChild(node);
      anchor = createDomRect({
        x: 20,
        y: 30,
        width: 15,
        height: 25
      });

      HoverBox.setGeometry(defaults());

      const anchorNode = getAnchorNode();
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-left')).toBe(
        '20px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-top')).toBe(
        '30px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-width')).toBe(
        '15px'
      );
      expect(getCustomProperty(anchorNode, '--jp-hoverbox-anchor-height')).toBe(
        '25px'
      );
    });
  });
});
