// Action: Table of Contents Crawler

import { tocStore, tocActiveId } from './stores.js';
import type { ObserverItem, TOCHeadingLink } from './types.js';

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
	let observers: ObserverItem[] = [];

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
			obs.observer.disconnect();
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
				text: elemHeading.firstChild?.textContent?.trim() || '',
				isVisible: false
			});

			const nextSibling = elemHeading.nextElementSibling;

			//for this to work, the sibling after a header MUST have the data-toc-content attribute
			if(!nextSibling?.hasAttribute('data-toc-content')) return;

			let isDetectTop = false;
			let isDetectBottom = false;
			const headingIndex = permalinkIndexCount++;

			const observer = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting && !isDetectTop && !isDetectBottom) {
					tocActiveId.set(elemHeading.id);
				}
			}, {
				rootMargin: '-50% 0px' ,
				threshold: 0,
			});

			observers.push({
				observer: observer,
				element: nextSibling,
			});

			//this observer looks for top content only
			const observerTop = new IntersectionObserver(
				([entry]) => {
					const topBounds = entry?.rootBounds?.top ?? 0;

					if (entry.isIntersecting) {
						tocActiveId.set(elemHeading.id);
						isDetectTop = true;
					} else if (isDetectTop && entry.boundingClientRect.y < topBounds) {
						tocActiveId.set(permalinks[headingIndex + 1].id);
						isDetectTop = false;
					}
				},
				{
					rootMargin: '1px 0px -50% 0px',
					threshold: 1,
					root: scrollContainer,
				}
			);

			observers.push({
				observer: observerTop,
				element: nextSibling,
			});

			//this observer looks for bottom content only
			const observerBottom = new IntersectionObserver(
				([entry]) => {
					const bottomBounds = entry?.rootBounds?.bottom ?? 0;

					if (entry.isIntersecting) {
						tocActiveId.set(elemHeading.id);
						isDetectBottom = true;
					} else if (isDetectBottom && entry.boundingClientRect.bottom > bottomBounds) {
						tocActiveId.set(permalinks[headingIndex - 1].id);
						isDetectBottom = false;
					}
				},
				{
					rootMargin: '-50% 0px 1px 0px',
					threshold: 1,
					root: scrollContainer,
				}
			);

			observers.push({
				observer: observerBottom,
				element: nextSibling,
			});
		});

		//set index 0 as the default
		tocActiveId.set(permalinks[0].id);

		// Set the store with the permalink array
		tocStore.set(permalinks);
	}

	function onWindowScroll(): void {

		//don't start observing anything until user starts scrolling
		for (const obsItem of observers) {
			obsItem.observer.observe(obsItem.element);
		}

		document.querySelector(scrollTarget)?.removeEventListener('scroll', onWindowScroll);
	}

	// Lifecycle
	init();
	if (scrollTarget) document.querySelector(scrollTarget)?.addEventListener('scroll', onWindowScroll);

	return {
		update(newArgs: TOCCrawlerArgs) {
			args = newArgs;
			init();
		},
		destroy() {
			for(const obs of observers)
			{
				obs.observer.disconnect();
			}

			if (scrollTarget) document.querySelector(scrollTarget)?.removeEventListener('scroll', onWindowScroll);
		}
	};
}
