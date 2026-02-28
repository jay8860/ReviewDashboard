import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownAnalysis = ({ content = '', compact = false }) => {
    const textSize = compact ? 'text-xs' : 'text-sm';
    const headingOffset = compact ? '' : 'tracking-tight';

    return (
        <div className={`text-slate-800 ${textSize} leading-relaxed`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ ...props }) => <h1 className={`mt-1 mb-3 text-xl font-black text-slate-900 ${headingOffset}`} {...props} />,
                    h2: ({ ...props }) => <h2 className={`mt-4 mb-2 text-lg font-black text-slate-900 ${headingOffset}`} {...props} />,
                    h3: ({ ...props }) => <h3 className={`mt-3 mb-2 text-base font-black text-slate-900 ${headingOffset}`} {...props} />,
                    h4: ({ ...props }) => <h4 className="mt-3 mb-1 text-sm font-black text-slate-900" {...props} />,
                    p: ({ ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                    ul: ({ ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
                    ol: ({ ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
                    li: ({ ...props }) => <li className="leading-relaxed marker:text-violet-500" {...props} />,
                    strong: ({ ...props }) => <strong className="font-black text-slate-900" {...props} />,
                    em: ({ ...props }) => <em className="italic text-slate-700" {...props} />,
                    blockquote: ({ ...props }) => <blockquote className="my-3 border-l-4 border-violet-300 bg-violet-50/60 px-3 py-2 rounded-r-lg text-slate-700" {...props} />,
                    table: ({ ...props }) => <table className="my-3 w-full border-collapse overflow-hidden rounded-xl border border-violet-100 bg-white text-left" {...props} />,
                    thead: ({ ...props }) => <thead className="bg-violet-50/80" {...props} />,
                    th: ({ ...props }) => <th className="border border-violet-100 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700" {...props} />,
                    td: ({ ...props }) => <td className="border border-violet-100 px-3 py-2 align-top text-slate-700" {...props} />,
                    hr: ({ ...props }) => <hr className="my-4 border-violet-100" {...props} />,
                    code: ({ inline, className, children, ...props }) => {
                        if (inline) {
                            return (
                                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={`block overflow-x-auto rounded-xl bg-slate-100 p-3 text-[12px] text-slate-800 ${className || ''}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    a: ({ ...props }) => <a className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-800" target="_blank" rel="noreferrer noopener" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownAnalysis;
