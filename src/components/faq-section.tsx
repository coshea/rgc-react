import React from "react";
import { Accordion, AccordionItem } from "@heroui/react";
import { Icon } from "@iconify/react";

export const FaqSection: React.FC = () => {
  const faqData = [
    {
      id: "1",
      question: "What is Acme?",
      answer:
        "Acme is a design system for building performant, accessible and beautiful web experiences.",
    },
    {
      id: "2",
      question: "How can I apply to the Open Source Discount?",
      answer:
        "To apply for the Open Source Discount, you need to submit your project details through our website. We review applications weekly and provide discounts based on the project's impact and reach in the open source community.",
    },
    {
      id: "3",
      question: "Can I use Acme for my freelance projects?",
      answer:
        "Yes, you can use Acme for your freelance projects. We offer flexible licensing options that cater to independent developers and small teams. Check our pricing page for more details.",
    },
  ];

  // Custom indicator component
  const CustomIndicator = ({ isOpen }: { isOpen?: boolean }) => (
    <div className="text-purple-500">
      {isOpen ? (
        <Icon icon="lucide:x" width={20} height={20} />
      ) : (
        <Icon icon="lucide:plus" width={20} height={20} />
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center justify-center w-full py-8">
        <h2 className="text-3xl font-bold text-center text-zinc-200">
          Frequently Asked Questions
        </h2>
      </div>
      <Accordion className="w-full" variant="splitted">
        {faqData.map((faq) => (
          <AccordionItem
            key={faq.id}
            aria-label={faq.question}
            title={faq.question}
            classNames={{
              base: "py-4 border-b border-zinc-800",
              title: "text-xl font-normal",
              trigger: "py-2",
              content: "text-zinc-400 py-4",
            }}
            indicator={({ isOpen }) => <CustomIndicator isOpen={isOpen} />}
          >
            {faq.answer}
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
};
