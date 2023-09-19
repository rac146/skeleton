// Action: Table of Contents Crawler

import { tocStore, tocActiveId } from './stores.js';
import type { TOCHeadingLink } from './types.js';

interface TOCCrawlerArgs {
	/** Set generate mode to automatically set heading IDs. */
	mode?: 'generate' | undefined;
	/** Provide query list of elements. Defaults h2-h6. */
	queryElements?: string;
	/* Provide a reference to the scrollable page element. */
	scrollTarget?: string;
	/** Reload the action when this key value changes. */
	key?: unknown;
	/* Provide a prefix for ToC links, to help keep them unique. */
	prefix?: string;
	/* Provide a suffix for ToC links, to help keep them unique. */
	suffix?: string;
}

export function tocCrawler(node: HTMLElement, args?: TOCCrawlerArgs) {
	let queryElements = 'h2, h3, h4, h5, h6';
	let scrollTarget = 'body';
	let headings: NodeListOf<HTMLElement> | undefined;
	let permalinks: TOCHeadingLink[] = [];
	let observers: IntersectionObserver[] = [];

	function init(): void {
		// Set accepted list of query elements
		// (IMPORTANT: must proceed resetting `headings` below)
		if (args?.queryElements) queryElements = args.queryElements;
		// Set the desired scroll target to monitor
		if (args?.scrollTarget) scrollTarget = args.scrollTarget;

		// Reset local values
		headings = node.querySelectorAll(queryElements);
		permalinks = [];

		// Query and process the headings
		queryHeadings();
	}

	function queryHeadings(): void {

		let permalinkIndexCount = 0;

		for(const obs of observers)
		{
			obs.disconnect();
		}

		observers = [];

		headings?.forEach((elemHeading) => {

			// If heading has ignore attribute, skip it
			if (elemHeading.hasAttribute('data-toc-ignore')) return;
			// If generate mode and heading ID not present, assign one
			if (args?.mode === 'generate' && !elemHeading.id) {
				const newHeadingId = elemHeading.firstChild?.textContent
					?.trim()
					.replaceAll(/[^a-zA-Z0-9 ]/g, '')
					.replaceAll(' ', '-')
					.toLowerCase();
				const prefix = args.prefix ? `${args.prefix}-` : '';
				const suffix = args.suffix ? `-${args.suffix}` : '';
				elemHeading.id = prefix + newHeadingId + suffix;
			}
			// Push heading data to the permalink array
			permalinks.push({
				element: elemHeading.nodeName.toLowerCase(),
				id: elemHeading.id,
				text: elemHeading.firstChild?.textContent?.trim() || ''
			});

			const headingIndex = permalinkIndexCount++;

			const observer = new IntersectionObserver(([entry]) => {
				if (entry.boundingClientRect.top > 0) {
					if (entry.isIntersecting) {
						tocActiveId.set(elemHeading.id);
					} else {
						const newIndex = headingIndex > 0 ? headingIndex - 1 : 0
						tocActiveId.set(permalinks[newIndex].id);

						console.log(elemHeading, permalinks[newIndex])
					}
				  }
			}, {
				root: document.querySelector(scrollTarget),
				threshold: 0
			});

			observer.observe(elemHeading);
			observers.push(observer);
		});

		tocActiveId.set(permalinks[0].id);

		// Set the store with the permalink array
		tocStore.set(permalinks);
	}

	// Lifecycle
	init();
	return {
		update(newArgs: TOCCrawlerArgs) {
			args = newArgs;
			init();
		},
		destroy() {
			for(const obs of observers)
			{
				obs.disconnect();
			}
		}
	};
}
