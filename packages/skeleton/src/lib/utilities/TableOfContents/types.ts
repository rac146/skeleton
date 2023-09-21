// Table of Content Types

export interface TOCHeadingLink {
	element: string;
	id: string;
	text: string;
	isVisible: boolean;
}

export interface ObserverItem {
	observer: IntersectionObserver;
	element: Element;
}
