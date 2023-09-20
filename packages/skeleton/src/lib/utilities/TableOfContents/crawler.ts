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
				text: elemHeading.firstChild?.textContent?.trim() || '',
				isVisible: false
			});

			const headingIndex = permalinkIndexCount++;
			const element = document.querySelector(scrollTarget) as HTMLElement;

			const observer = new IntersectionObserver(([entry]) => {
						
				if (!entry.isIntersecting) {

					if(entry.rootBounds && entry.boundingClientRect.top < entry.rootBounds.top) {
						console.log('outside top', elemHeading, entry)
						permalinks[headingIndex].isVisible = false;

						//must check if any other headingIndex is currently visible
						for(let x = (headingIndex + 1); x < permalinks.length; x++) 
						{
							const nextHeading = permalinks[x];

							if(nextHeading.isVisible) {
								tocActiveId.set(nextHeading.id);
								break;
							}

						}
					} else if(entry.rootBounds && entry.boundingClientRect.bottom >= entry.rootBounds.bottom) {
						console.log('outside bottom', elemHeading, entry)

						if(headingIndex > 0) {
							tocActiveId.set(permalinks[headingIndex - 1].id);
						}

						permalinks[headingIndex].isVisible = false;
					}

				} else {

					console.log('inside', elemHeading, entry)

					permalinks[headingIndex].isVisible = true;

					let checkPrevious = true;

					//must check if any other headingIndex is currently visible
					for(let x = 0; x < headingIndex; x++) 
					{
						const prevHeading = permalinks[x];

						if(prevHeading.isVisible) {
							checkPrevious = false;
							break;
						}
					}

					if(checkPrevious) {
						tocActiveId.set(elemHeading.id);
					}
				}
			}, {
				root: element,
				threshold: 1
			});

			observer.observe(elemHeading);
			observers.push(observer);
		});

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
