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

		for(const obs of observers)
		{
			obs.disconnect();
		}

		observers = [];

		// Query and process the headings
		queryHeadings();
	}

	function queryHeadings(): void {

		let permalinkIndexCount = 0;

		const scrollContainer = document.querySelector(scrollTarget) as HTMLElement;

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

			const divCheck = document.createElement("div");
			divCheck.classList.add("toc-check")

			elemHeading?.parentNode?.insertBefore(divCheck, elemHeading.nextSibling);

			const headingIndex = permalinkIndexCount++;

			const beforeObserver = new IntersectionObserver(
				([entry]) => {

					const topBounds = entry?.rootBounds?.top ?? 0;

					if (entry.isIntersecting && entry.boundingClientRect.y > topBounds + 50) {
						//console.log('in space top', entry, elem.getBoundingClientRect());
						tocActiveId.set(elemHeading.id);
					} else if (
						!entry.isIntersecting &&
						entry.boundingClientRect.y > topBounds + 50 &&
						entry.boundingClientRect.y < topBounds + 50 + scrollContainer.offsetHeight
					) {
						tocActiveId.set(permalinks[headingIndex - 1]?.id);
						//console.log('out of space top', entry, elem.getBoundingClientRect());
					}

				},
				{
					rootMargin: '50px 0px -75% 0px',
					threshold: 0,
					root: scrollContainer,
				}
			);

			beforeObserver.observe(divCheck);
			observers.push(beforeObserver);

			const afterObserver = new IntersectionObserver(
				([entry]) => {

					const bottomBounds = entry?.rootBounds?.bottom ?? 0;

					if (entry.isIntersecting && entry.boundingClientRect.y < bottomBounds - 50) {
						//console.log('in space bottom', entry, elem.getBoundingClientRect());
						tocActiveId.set(permalinks[headingIndex - 1]?.id);
					} else if (!entry.isIntersecting && entry.boundingClientRect.y < bottomBounds - 50) {
						//console.log('out of space bottom', entry);
						tocActiveId.set(elemHeading.id);
					}

				},
				{
					rootMargin: '-75% 0px 50px 0px',
					threshold: 0,
					root: scrollContainer,
				}
			);

			afterObserver.observe(elemHeading);
			observers.push(afterObserver);
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
