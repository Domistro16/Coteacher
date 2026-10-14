COTEACHER: Another chance at the lesson

THE PROBLEM:

In a lot of Nigerian classrooms, one teacher is teaching a large number of students at the same time. For example, in Kano State, a state education census reported about 105 pupils per teacher in public primary and pre-primary schools (Daily Trust, reporting the state census), against a national policy benchmark of 35 for primary schools. The problem with that is that it is very easy for a student to get lost somewhere in the lesson without the teacher even noticing. And even if the teacher notices, they may not have the time or opportunity to understand the needs of all of their students in order to adapt their teaching for each of them.
Also, once the lesson ends, the teacher's explanation is basically gone. The student can read their notes from the lesson again, but that does not always help because sometimes what they need is for the particular part they got lost to be explained differently and carefully.
Private lesson teachers are also not an option for everyone, and a normal AI chatbot has another problem. It does not actually know exactly what your teacher taught you. And it does not know the example your teacher used, or where you became confused or what you were supposed to understand from that particular lesson.
So students can keep moving from topic to topic and are still carrying confusions from previous lessons and sometimes the teacher only finds out when the pattern starts showing in tests or when marking their exam scripts.

WHAT I WILL BUILD:

The idea behind Coteacher is to give the student another way of understanding their own classroom lesson while also helping the teacher see where students are struggling.
Before the class, the teacher uploads their notes together with the textbook or other sources they are using for that lesson. Then Coteacher uses those materials to help prepare the lesson and create different visuals or visual aids or ways of explaining the same concepts with everything grounded in the sources the teacher provided.
Where it makes sense, one of those versions can also be a simple "Try it" activity using things the student can easily find around them. I want this because sometimes explaining something again is still not enough. A student may understand it much faster once they actually do something with the idea.
During the lesson, Coteacher can bring up the visual that matches what the teacher is currently explaining, shown on the teacher's screen or projector, and keep the class as a timeline. In the sprint the teacher will advance the visuals with a tap, and automatic following of the teacher's speech would come later.
The part I am most interested in happens after the lesson.
Each student gets their own personalized copy of that lesson that they can go back into. It works offline as a progressive web app, so once the lesson has been collected, the student does not need to stay connected to the internet to use it.
While going through the lesson, a student can press a button and say something like, "Pause here. I understand this part, but I don't understand this," or they can just type it.
Coteacher then goes back to that exact part of the teacher's lesson and explains it differently, using the teacher's own material or other credible sources the teacher has approved.
If the student completes one of the "Try it" activities, Coteacher connects the activity back to the exact concept from the original lesson so that it is not just an experiment they did without understanding why. This is very important because it is key for students to always understand why it works and not just how it works.
In addition, because the lesson needs to work offline, likely personalized questions can be prepared in advance and included in the personalized lesson package for each student. If a student asks something that was not predicted, Coteacher does not pretend to know the answer offline. It saves the question and, when the device gets a connection again, it can answer it using the approved sources.
The quizzes can also come from the places where that particular student paused or struggled. The goal is not to give different students completely different learning objectives. They should still reach the same objective, but one student may need a different explanation or route to get there.
The teacher also gets something useful from all of this. When the students' progress comes back to the school, the teacher can see a heatmap showing the points where the class struggled the most. If different versions of a visual aid were used, Coteacher can show which prepared versions were used and which checks followed. These small simulated observations cannot establish which version works better.
So when the teacher is preparing to teach that topic again, they can get a small reminder such as, "Students struggled here last time, try showing this demonstration when you reach this point," and similar pointers like that.
For this sprint, I am not trying to build the entire system at once. I will build a working proof of concept using Codex with one lesson, one safe hands-on activity, two student profiles and simulated class data that will be clearly labelled as simulated.

HOW IT REACHES LEARNERS WITH LIMITED ACCESS:

This section is included because of the need to tackle the same issues earlier described with those who do have limited access to certain resources. I do not want the idea to depend on every student having constant internet access, because that immediately leaves out a lot of the students I actually want it to help.
The school is the distribution point. Teachers prepare and approve lessons wherever there is a connection. Because many schools restrict students' phones, lessons can reach students in more than one way like through shared school devices during supervised sessions, or through a parent's phone, using the school's connection or a file transfer from a teacher's device. Students study offline and bring their questions and progress back on their next visit. Several learners can share one device, each with a separate PIN-protected profile and their own place in the lesson, so nobody's progress gets mixed up. The first version is aimed at schools and communities that have some devices and some connectivity, and I will test it on low-end Android phones.
For the sprint, I want to demonstrate this properly: a learner collects a lesson, the connection is switched off, they continue learning and ask a question, then later return the question and progress record when the device is connected again. I also want to show two learners taking turns on the same device.
This still does not solve every problem because students will need access to a device in the first place, and devices need charging, and somebody has to maintain whatever access point is being used at the school or community level.
I do not want to pretend those problems are no longer there because the software works offline. For Coteacher to reach students who have very little access, there would still need to be a school or community partner involved, and I definitely see that as part of the proposal and future project work.

HOW IT FITS THE HACKATHON CHALLENGE:

Coteacher fits primarily into the second track because the main idea is to help students stay in the learning journey after they start falling behind. It also connects with parts of the first and third track.
Coteacher also turns a lesson from a one-time event into an ongoing learning process. It helps students return to difficult concepts, to close gaps before they become messy and tangled in the student's mind, and stay on track for later subjects, assessments and opportunities.
The content is based on sources provided by the teacher rather than allowing the AI to teach whatever it wants. In the sprint, the supplied manually prepared instruction is compared with the reviewed demo bundle before collection or publication. Source-ID checks do not verify factual accuracy; the teacher remains responsible for factual and safety review.
Once the complete audio, visual package and app shell are saved, the lesson works offline. Typed questions always work locally; optional voice input requires an installed on-device browser recognizer and otherwise asks the student to type, and they can choose the kind of explanation that helps them without being permanently labelled as a particular type of learner.
The current demo keeps encrypted learner records on the device and returns them to the configured local school service, using simulated profiles and no external AI. Data location depends on deployment: if an external provider is configured, disclose what that provider receives rather than claiming school-exclusive storage. The system is also something I would want to extend to more African languages over time. I am starting with Nigerian classrooms, and the approach could apply in other African settings where classes are large and connectivity is limited.

WHAT EXCITES ME ABOUT IT:

What excites me about Coteacher is the idea that a lesson does not have to disappear once the teacher finishes teaching it.
A teacher can genuinely try their best and still miss the fact that one student got lost ten minutes into the lesson. With a large class, it is almost impossible to notice every single person.
At the same time, I do not think the answer is to replace that teacher with AI.
I want Coteacher to make the lesson the teacher already taught easier for each student to return to and understand. If explaining it again is enough, it explains it again. If the student needs to actually see or do something before it clicks, it can give them that option too.
And when students struggle, that information should not disappear either. It should come back to the teacher in a useful way so that the next lesson can be better.
Personally, that is the part of the idea I really like. The student gets another chance at the lesson, and the teacher gets another chance to understand the class.
I see Coteacher as one possible step towards making learning in Nigeria, and potentially across Africa, more adaptive to each student without assuming that every student has perfect internet, their own device or access to a private lesson teacher.

## Sprint priorities
- This is a 4-day hackathon proof of concept, judged on a working demo. A reliable core loop beats breadth.
- Priority order: (1) the demo acceptance test passes offline, including reopening the app with no connection, (2) every answer shows its source, (3) the teacher heatmap and nudge work from seeded data, (4) everything else.
- Prefer the simplest approach that works on a low-end Android phone. Stub described-only features.
- When two options conflict, choose the one that keeps the demo path working.