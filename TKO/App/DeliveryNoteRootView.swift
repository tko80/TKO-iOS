import SwiftUI

enum AppTab: String, CaseIterable { case create="New Note", history="History" }
struct RootView: View {
    var onClose: (() -> Void)? = nil
    @EnvironmentObject var store: DeliveryStore
    @State private var tab:AppTab = .create
    @State private var receiver=""
    @State private var note=""
    @State private var date=Date()
    @State private var items:[DeliveryItem]=[DeliveryItem(name:"",quantity:"")]
    @State private var strokes:[SignaturePad.Stroke]=[]
    @State private var editing:UUID?
    @State private var search=""
    @State private var selected:DeliveryRecord?
    @State private var alertText=""
    @State private var showAlert=false
    var body: some View {
        ZStack {
            Color(red:0.955,green:0.968,blue:0.99).ignoresSafeArea()
            VStack(spacing:0) {
                header
                ScrollView(showsIndicators:false) {
                    Group {
                        switch tab {
                        case .create: createView
                        case .history: historyView
                        }
                    }
                    .frame(maxWidth:760)
                    .frame(maxWidth:.infinity)
                    .padding(.bottom,18)
                }
                bottomNavigation
            }
            .frame(maxWidth:.infinity,maxHeight:.infinity)
        }
        .frame(maxWidth:.infinity,maxHeight:.infinity)
        .environment(\.colorScheme, .light)
        .ignoresSafeArea(.container,edges:.all)
        .ignoresSafeArea(.keyboard,edges:.bottom)
        .alert("DeliveryNote",isPresented:$showAlert){Button("OK",role:.cancel){} } message:{Text(alertText)}
        .sheet(item:$selected){ record in RecordDetail(record:record,onEdit:{edit(record)},onDelete:{store.delete(record);selected=nil}) }
    }
    private var bottomNavigation: some View {
        HStack(spacing:8) {
            ForEach(AppTab.allCases,id:\.self) { t in
                Button {
                    withAnimation(.spring(response:0.28, dampingFraction:0.82)) { tab=t }
                } label: {
                    VStack(spacing:5) {
                        Image(systemName:icon(t)).font(.system(size:18,weight:.semibold))
                        Text(t.rawValue).font(.system(size:10,weight:.semibold))
                    }
                    .foregroundStyle(tab == t ? Color.blue : Color.gray)
                    .frame(maxWidth:.infinity).padding(.vertical,10)
                    .background(tab == t ? Color.blue.opacity(0.09) : .clear,in:RoundedRectangle(cornerRadius:14))
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal,14).padding(.top,8).padding(.bottom,6)
        .background(.ultraThinMaterial)
        .overlay(alignment:.top){Rectangle().fill(Color.black.opacity(0.06)).frame(height:1)}
    }
    private var header: some View {
        VStack(alignment:.leading,spacing:13) {
            HStack(spacing:11) {
                Image("AppMark").resizable().scaledToFit().frame(width:38,height:38).clipShape(RoundedRectangle(cornerRadius:11))
                VStack(alignment:.leading,spacing:2) {
                    Text("DeliveryNote").font(.system(size:19,weight:.bold,design:.rounded)).lineLimit(1).minimumScaleFactor(0.8)
                    Text("DELIVERY MANAGEMENT").font(.system(size:8,weight:.bold)).tracking(1.1).opacity(0.78).lineLimit(1)
                }.fixedSize(horizontal:false,vertical:true)
                Spacer(minLength:4)
                HStack(spacing:5) {
                    Circle().fill(Color.green).frame(width:6,height:6)
                    Text("OFFLINE").font(.system(size:8,weight:.bold)).tracking(0.4).lineLimit(1)
                }.padding(.horizontal,8).padding(.vertical,7).background(.white.opacity(0.16),in:Capsule())
                if let onClose {
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size:12,weight:.bold))
                            .foregroundStyle(.white)
                            .frame(width:32,height:32)
                            .background(.white.opacity(0.16),in:Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close Delivery Note")
                }
            }
            HStack(spacing:10) {
                statCard("TOTAL NOTES","\(store.records.count)","doc.text.fill")
                statCard("TODAY","\(store.records.filter{Calendar.current.isDateInToday($0.date)}.count)","calendar")
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal,18).padding(.top,12).padding(.bottom,16)
        .background(LinearGradient(colors:[Color(red:0.035,green:0.19,blue:0.58),Color(red:0.10,green:0.43,blue:0.91),Color(red:0.13,green:0.62,blue:0.96)],startPoint:.topLeading,endPoint:.bottomTrailing).ignoresSafeArea(edges:.top))
    }
    private func statCard(_ title:String,_ value:String,_ symbol:String)->some View{
        HStack(spacing:11){Image(systemName:symbol).font(.system(size:18,weight:.semibold)).frame(width:38,height:38).background(.white.opacity(0.16),in:RoundedRectangle(cornerRadius:12));VStack(alignment:.leading,spacing:2){Text(value).font(.system(size:21,weight:.bold,design:.rounded));Text(title).font(.system(size:9,weight:.bold)).tracking(1.1).opacity(0.8)};Spacer(minLength:0)}
            .padding(12).frame(maxWidth:.infinity,alignment:.leading).background(.white.opacity(0.13),in:RoundedRectangle(cornerRadius:16))
    }
    private func icon(_ t:AppTab)->String { switch t {case .create:"square.and.pencil";case .history:"clock.arrow.circlepath"} }
    private var createView:some View {
        VStack(alignment:.leading,spacing:15) {
            sectionTitle(editing == nil ? "Create delivery note":"Edit delivery note","Fill in the details below")
            VStack(alignment:.leading,spacing:14) {
                fieldLabel("RECEIVER NAME")
                TextField("Enter receiver name / မြန်မာစာ",text:$receiver).textInputAutocapitalization(.words).foregroundStyle(Color.primary).padding(14).background(Color(red:0.965,green:0.975,blue:0.995),in:RoundedRectangle(cornerRadius:13))
                HStack(spacing:12){VStack(alignment:.leading,spacing:7){fieldLabel("DATE");DatePicker("",selection:$date,displayedComponents:.date).labelsHidden().datePickerStyle(.compact)};VStack(alignment:.leading,spacing:7){fieldLabel("TIME");DatePicker("",selection:$date,displayedComponents:.hourAndMinute).labelsHidden().datePickerStyle(.compact)};Spacer()}
            }.card()
            VStack(alignment:.leading,spacing:12) {
                HStack{fieldLabel("DELIVERY ITEMS");Spacer();Text("\(items.count) ITEMS").font(.system(size:10,weight:.bold)).foregroundStyle(.blue)}
                ForEach($items){$item in
                    HStack(spacing:9){TextField("Item name",text:$item.name).foregroundStyle(Color.primary).frame(maxWidth:.infinity).padding(12).background(Color(red:0.965,green:0.975,blue:0.995),in:RoundedRectangle(cornerRadius:11));TextField("Qty",text:$item.quantity).foregroundStyle(Color.primary).keyboardType(.decimalPad).frame(width:70).padding(12).background(Color(red:0.965,green:0.975,blue:0.995),in:RoundedRectangle(cornerRadius:11));Button{if items.count>1{items.removeAll{$0.id==item.id}}}label:{Image(systemName:"minus.circle.fill").foregroundStyle(.red).font(.title3)}}
                }
                Button{items.append(DeliveryItem(name:"",quantity:""))}label:{Label("Add another item",systemImage:"plus.circle.fill").font(.system(size:14,weight:.semibold)).foregroundStyle(.blue)}
            }.card()
            VStack(alignment:.leading,spacing:9){fieldLabel("ADDITIONAL NOTE");TextField("Optional delivery details…",text:$note,axis:.vertical).foregroundStyle(Color.primary).lineLimit(2...4).padding(13).background(Color(red:0.965,green:0.975,blue:0.995),in:RoundedRectangle(cornerRadius:12))}.card()
            VStack(alignment:.leading,spacing:12){
                HStack{fieldLabel("RECEIVER SIGNATURE");Spacer();Button("Clear"){strokes=[]}.font(.system(size:12,weight:.semibold)).foregroundStyle(.red)}
                SignaturePad(strokes:$strokes)
                Text("Sign using your finger or Apple Pencil. Tap once to make a dot.").font(.system(size:11)).foregroundStyle(.secondary)
            }.card()
            Button(action:saveRecord){HStack{Image(systemName:"checkmark.seal.fill");Text(editing == nil ? "Save Delivery Note":"Update Delivery Note");Spacer();Image(systemName:"arrow.right")}.font(.system(size:15,weight:.bold)).foregroundStyle(.white).padding(17).background(LinearGradient(colors:[.blue,Color(red:0.08,green:0.42,blue:0.91)],startPoint:.leading,endPoint:.trailing),in:RoundedRectangle(cornerRadius:16)).shadow(color:.blue.opacity(0.22),radius:12,y:6)}
        }.padding(18)
    }
    private var historyView:some View {
        VStack(alignment:.leading,spacing:14){sectionTitle("Delivery history","All saved notes on this iPhone")
            TextField("Search receiver or item…",text:$search).foregroundStyle(Color.black).padding(14).background(.white,in:RoundedRectangle(cornerRadius:14))
            if filtered.isEmpty { VStack(spacing:10){Image(systemName:"shippingbox").font(.system(size:36)).foregroundStyle(.blue.opacity(0.5));Text("No delivery notes yet").font(.headline);Text("Your saved notes will appear here").font(.caption).foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(40).card() }
            ForEach(filtered){r in Button{selected=r}label:{HStack(spacing:12){Image(systemName:"doc.text.fill").font(.system(size:19)).foregroundStyle(.blue).frame(width:44,height:44).background(Color.blue.opacity(0.09),in:RoundedRectangle(cornerRadius:13));VStack(alignment:.leading,spacing:4){Text(r.receiver).font(.system(size:15,weight:.bold)).foregroundStyle(.primary);Text("\(r.items.count) item(s) • \(r.date.formatted(date:.abbreviated,time:.shortened))").font(.system(size:11)).foregroundStyle(.secondary)};Spacer();Image(systemName:"chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)}.padding(14).background(.white,in:RoundedRectangle(cornerRadius:16))}.buttonStyle(.plain)}
        }.padding(18)
    }
    private var filtered:[DeliveryRecord] { store.records.filter{search.isEmpty || $0.receiver.localizedCaseInsensitiveContains(search) || $0.items.contains{$0.name.localizedCaseInsensitiveContains(search)}} }
    private func sectionTitle(_ title:String,_ subtitle:String)->some View{VStack(alignment:.leading,spacing:4){Text(title).font(.system(size:22,weight:.bold,design:.rounded));Text(subtitle).font(.system(size:12)).foregroundStyle(.secondary)}.frame(maxWidth:.infinity,alignment:.leading)}
    private func fieldLabel(_ text:String)->some View{Text(text).font(.system(size:10,weight:.bold)).tracking(1.3).foregroundStyle(Color(red:0.32,green:0.40,blue:0.54))}
    private func saveRecord(){guard !receiver.trimmingCharacters(in:.whitespaces).isEmpty else{alert("Please enter receiver name");return};guard items.allSatisfy({!$0.name.trimmingCharacters(in:.whitespaces).isEmpty && Double($0.quantity) != nil}) else{alert("Please complete item names and quantities");return};guard !strokes.isEmpty else{alert("Receiver signature is required");return}
        let sig=(try? JSONEncoder().encode(strokes)) ?? Data()
        store.save(DeliveryRecord(id:editing ?? UUID(),receiver:receiver,date:date,items:items,note:note,signature:sig))
        reset();tab = .history;alert("Delivery note saved successfully")
    }
    private func reset(){receiver="";note="";date=Date();items=[DeliveryItem(name:"",quantity:"")];strokes=[];editing=nil}
    private func edit(_ r:DeliveryRecord){receiver=r.receiver;date=r.date;items=r.items;note=r.note;strokes=(try? JSONDecoder().decode([SignaturePad.Stroke].self,from:r.signature)) ?? [];editing=r.id;selected=nil;tab = .create}
    private func alert(_ s:String){alertText=s;showAlert=true}
}
struct RecordDetail:View {
    let record:DeliveryRecord;let onEdit:()->Void;let onDelete:()->Void
    var body:some View{NavigationStack{ScrollView{VStack(alignment:.leading,spacing:15){Text(record.receiver).font(.title.bold());Text(record.date.formatted(date:.long,time:.shortened)).foregroundStyle(.secondary);ForEach(record.items){i in HStack{Text(i.name);Spacer();Text(i.quantity).bold()}.padding(13).background(Color.blue.opacity(0.06),in:RoundedRectangle(cornerRadius:12))};if !record.note.isEmpty{Text(record.note)};if let strokes=try? JSONDecoder().decode([SignaturePad.Stroke].self,from:record.signature){SignaturePreview(strokes:strokes).frame(height:130)}}.padding()}.navigationTitle("Delivery Note").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.topBarTrailing){Button("Edit",action:onEdit)};ToolbarItem(placement:.bottomBar){Button("Delete",role:.destructive,action:onDelete)}}}}
}
struct SignaturePreview:View{let strokes:[SignaturePad.Stroke];var body:some View{Canvas{ctx,size in for s in strokes{guard let first=s.points.first else{continue};var p=Path();p.move(to:first.cg);for v in s.points.dropFirst(){p.addLine(to:v.cg)};ctx.stroke(p,with:.color(.black),style:StrokeStyle(lineWidth:2.4,lineCap:.round,lineJoin:.round))}}.background(.white).overlay(RoundedRectangle(cornerRadius:12).stroke(.gray.opacity(0.3)))}
}
extension View{func card()->some View{padding(16).frame(maxWidth:.infinity,alignment:.leading).foregroundStyle(Color(red:0.10,green:0.15,blue:0.24)).background(.white,in:RoundedRectangle(cornerRadius:20)).overlay(RoundedRectangle(cornerRadius:20).stroke(Color.black.opacity(0.035),lineWidth:1)).shadow(color:.black.opacity(0.035),radius:12,y:5)}}
