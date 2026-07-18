import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Cabeçalho padrão de página — título + descrição + ações responsivas. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="page-hero">
    <div className="page-hero-copy">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {actions ? <div className="page-hero-actions">{actions}</div> : null}
  </div>
);

export default PageHeader;
