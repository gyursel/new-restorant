import type { ReactNode } from "react";

export function MenuCardFrame({photo,children,className="",testId}: {
  photo:ReactNode;children:ReactNode;className?:string;testId?:string;
}) {
  return <article className={"food-card group "+className} data-testid={testId}>
    {photo}
    <div className="food-card-content">{children}</div>
  </article>;
}
