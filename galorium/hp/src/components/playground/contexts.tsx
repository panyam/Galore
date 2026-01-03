
import * as React from "react"
import * as TSU from "@panyam/tsutils";

export class BaseComponent<T=any> extends React.Component<T> {
  static readonly eventHub = new TSU.Events.EventHub();
  constructor(props: T, context: any) {
    super(props, context);
    this.eventHubChanged();
  }

  get eventHub(): TSU.Events.EventHub {
    return BaseComponent.eventHub;
  }

  eventHubChanged() {
  }
}
